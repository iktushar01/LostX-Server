import { prisma } from "../../lib/prisma";
import { envVars } from "../../../config/env";
import type { ChatbotMatch, ChatbotResponse, ReindexResult } from "./chatbot.interface";
import {
    buildFallbackAnswer,
    buildRagContext,
    CHATBOT_SYSTEM_PROMPT,
} from "./chatbot.utils";
import { EmbeddingService } from "./embedding.service";
import { KeywordSearchService } from "./keyword-search.service";
import { OpenRouterService } from "./openrouter.service";
import { VectorSearchService } from "./vector-search.service";

const mergeMatches = (
    primary: ChatbotMatch[],
    secondary: ChatbotMatch[],
): ChatbotMatch[] => {
    const seen = new Set<string>();
    const merged: ChatbotMatch[] = [];

    for (const match of [...primary, ...secondary]) {
        const key = `${match.type}:${match.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(match);
    }

    return merged
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, envVars.CHATBOT_TOP_K);
};

export const ChatbotService = {
    chat: async (message: string, userId?: string): Promise<ChatbotResponse> => {
        // Step 1 — embed the user's natural-language query.
        const queryEmbedding = await OpenRouterService.createEmbedding(message);

        // Step 2a — vector similarity search (items with embeddings).
        const vectorMatches = await VectorSearchService.search(queryEmbedding);

        // Step 2b — keyword fallback for items missing embeddings or weak vector scores.
        const keywordMatches = await KeywordSearchService.search(message);

        const matches = mergeMatches(vectorMatches, keywordMatches);

        // Step 3 — assemble grouped RAG context from DB rows only.
        const ragContext = buildRagContext(matches);

        const meta = {
            matchCount: matches.length,
            topSimilarity: matches[0]?.similarity ?? null,
        };

        // Step 4 — ask the LLM to answer using ONLY retrieved context.
        let answer: string;

        try {
            answer = await OpenRouterService.generateChatCompletion(
                CHATBOT_SYSTEM_PROMPT,
                `Retrieved database context:\n${ragContext}\n\nUser question:\n${message}`,
            );
        } catch (error) {
            console.error("[ChatbotService] LLM failed, using retrieval-only fallback:", error);
            answer = buildFallbackAnswer(matches);
        }

        const response: ChatbotResponse = { answer, matches, meta };

        // Step 6 — persist chat history when the table is available.
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
