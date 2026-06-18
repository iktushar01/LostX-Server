import { prisma } from "../../lib/prisma";
import type { ChatbotResponse, ReindexResult } from "./chatbot.interface";
import {
    buildFallbackAnswer,
    buildRagContext,
    CHATBOT_SYSTEM_PROMPT,
} from "./chatbot.utils";
import { EmbeddingService } from "./embedding.service";
import { OpenRouterService } from "./openrouter.service";
import { VectorSearchService } from "./vector-search.service";

export const ChatbotService = {
    chat: async (message: string, userId?: string): Promise<ChatbotResponse> => {
        // Step 1 — embed the user's natural-language query.
        const queryEmbedding = await OpenRouterService.createEmbedding(message);

        // Step 2 — retrieve the most similar lost/found items from pgvector.
        const matches = await VectorSearchService.search(queryEmbedding);

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
