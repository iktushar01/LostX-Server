import { prisma } from "../../lib/prisma.js";
import { envVars } from "../../../config/env.js";
import type { ChatbotMatch, ChatbotResponse, ReindexResult } from "./chatbot.interface.js";
import { detectSearchIntent, getIntentGuidance } from "./chatbot.intent.js";
import { enrichMatchesWithRuleScores } from "./chatbot.match-enrichment.js";
import {
    buildFallbackAnswer,
    buildRagContext,
    CHATBOT_SYSTEM_PROMPT,
} from "./chatbot.utils.js";
import { EmbeddingService } from "./embedding.service.js";
import { KeywordSearchService } from "./keyword-search.service.js";
import { OpenRouterService } from "./openrouter.service.js";
import { VectorSearchService } from "./vector-search.service.js";

const mergeMatches = (
    primary: ChatbotMatch[],
    secondary: ChatbotMatch[],
): ChatbotMatch[] => {
    const byKey = new Map<string, ChatbotMatch>();

    for (const match of [...primary, ...secondary]) {
        const key = `${match.type}:${match.id}`;
        const existing = byKey.get(key);
        if (!existing || match.similarity > existing.similarity) {
            byKey.set(key, match);
        }
    }

    return [...byKey.values()]
        .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
        .slice(0, envVars.CHATBOT_TOP_K);
};

export const ChatbotService = {
    chat: async (message: string, userId?: string): Promise<ChatbotResponse> => {
        const scope = detectSearchIntent(message);

        const queryEmbedding = await OpenRouterService.createEmbedding(message);

        const [vectorMatches, keywordMatches] = await Promise.all([
            VectorSearchService.search(queryEmbedding, scope),
            KeywordSearchService.search(message, scope),
        ]);

        let matches = mergeMatches(vectorMatches, keywordMatches);
        matches = await enrichMatchesWithRuleScores(matches, userId, scope.intent);
        matches = matches
            .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
            .slice(0, envVars.CHATBOT_TOP_K);

        const ragContext = buildRagContext(matches);
        const intentGuidance = getIntentGuidance(scope.intent);

        const meta = {
            matchCount: matches.length,
            topSimilarity: matches[0]?.similarity ?? null,
            intent: scope.intent,
        };

        let answer: string;

        try {
            answer = await OpenRouterService.generateChatCompletion(
                CHATBOT_SYSTEM_PROMPT,
                `User intent: ${scope.intent}\n${intentGuidance}\n\nRetrieved database context:\n${ragContext}\n\nUser question:\n${message}`,
            );
        } catch (error) {
            console.error("[ChatbotService] LLM failed, using retrieval-only fallback:", error);
            answer = buildFallbackAnswer(matches);
        }

        const response: ChatbotResponse = { answer, matches, meta };

        try {
            await prisma.chatLog.create({
                data: {
                    userId: userId ?? null,
                    message,
                    answer,
                    matches,
                },
            });
        } catch (error) {
            console.error("[ChatbotService] Failed to persist chat log:", error);
        }

        return response;
    },

    reindexMissingEmbeddings: async (): Promise<ReindexResult> => {
        const [lostItems, foundItems] = await Promise.all([
            prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM lost_items WHERE embedding IS NULL
            `,
            prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM found_items WHERE embedding IS NULL
            `,
        ]);

        let failed = 0;

        for (const item of lostItems) {
            try {
                await EmbeddingService.upsertLostItemEmbedding(item.id);
            } catch {
                failed += 1;
            }
        }

        for (const item of foundItems) {
            try {
                await EmbeddingService.upsertFoundItemEmbedding(item.id);
            } catch {
                failed += 1;
            }
        }

        return {
            lostProcessed: lostItems.length,
            foundProcessed: foundItems.length,
            failed,
        };
    },
};
