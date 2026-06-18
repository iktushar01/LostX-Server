import { prisma } from "../../lib/prisma";
import type { ItemEmbeddingFields, ItemEmbeddingType } from "./chatbot.interface";
import { buildItemEmbeddingText, toPgVectorLiteral } from "./chatbot.utils";
import { OpenRouterService } from "./openrouter.service";

const scheduleEmbedding = (task: () => Promise<void>, label: string) => {
    void task().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[EmbeddingService] ${label} failed:`, message);
    });
};

export const EmbeddingService = {
    buildItemEmbeddingText,

    embedItemText: async (text: string): Promise<number[]> =>
        OpenRouterService.createEmbedding(text),

    upsertLostItemEmbedding: async (lostItemId: string): Promise<void> => {
        const item = await prisma.lostItem.findUnique({
            where: { id: lostItemId },
            select: {
                id: true,
                title: true,
                description: true,
                category: true,
                location: true,
                dateLost: true,
            },
        });

        if (!item) {
            return;
        }

        const text = buildItemEmbeddingText(item, "LOST");
        const embedding = await OpenRouterService.createEmbedding(text);
        const vector = toPgVectorLiteral(embedding);

        await prisma.$executeRaw`
            UPDATE lost_items
            SET embedding = ${vector}::vector
            WHERE id = ${item.id}
        `;
    },

    upsertFoundItemEmbedding: async (foundItemId: string): Promise<void> => {
        const item = await prisma.foundItem.findUnique({
            where: { id: foundItemId },
            select: {
                id: true,
                title: true,
                description: true,
                category: true,
                location: true,
                dateFound: true,
            },
        });

        if (!item) {
            return;
        }

        const text = buildItemEmbeddingText(item, "FOUND");
        const embedding = await OpenRouterService.createEmbedding(text);
        const vector = toPgVectorLiteral(embedding);

        await prisma.$executeRaw`
            UPDATE found_items
            SET embedding = ${vector}::vector
            WHERE id = ${item.id}
        `;
    },

    scheduleLostItemEmbedding: (lostItemId: string) => {
        scheduleEmbedding(
            () => EmbeddingService.upsertLostItemEmbedding(lostItemId),
            `lost item ${lostItemId}`,
        );
    },

    scheduleFoundItemEmbedding: (foundItemId: string) => {
        scheduleEmbedding(
            () => EmbeddingService.upsertFoundItemEmbedding(foundItemId),
            `found item ${foundItemId}`,
        );
    },

    buildTextFromFields: (
        item: ItemEmbeddingFields,
        type: ItemEmbeddingType,
    ): string => buildItemEmbeddingText(item, type),
};
