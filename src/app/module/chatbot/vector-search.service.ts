import { Prisma } from "../../lib/prisma-exports";
import { prisma } from "../../lib/prisma";
import { envVars } from "../../../config/env";
import type { ChatbotMatch } from "./chatbot.interface";
import type { SearchScope } from "./chatbot.intent";
import { toPgVectorLiteral } from "./chatbot.utils";

type VectorRow = {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    imageUrl: string | null;
    status: string;
    date: Date;
    similarity: number | string;
};

const mapRow = (row: VectorRow, type: ChatbotMatch["type"]): ChatbotMatch => {
    const similarity = Number(row.similarity);
    return {
        id: row.id,
        type,
        title: row.title,
        description: row.description,
        category: row.category,
        location: row.location,
        imageUrl: row.imageUrl,
        status: row.status,
        date: new Date(row.date).toISOString(),
        similarity,
        score: Math.round(similarity * 100),
    };
};

export const VectorSearchService = {
    search: async (
        embedding: number[],
        scope: Pick<SearchScope, "includeLost" | "includeFound"> = {
            includeLost: true,
            includeFound: true,
        },
    ): Promise<ChatbotMatch[]> => {
        const vector = toPgVectorLiteral(embedding);
        const perTableLimit = envVars.CHATBOT_TOP_K;

        const lostQuery = scope.includeLost
            ? prisma.$queryRaw<VectorRow[]>(Prisma.sql`
                SELECT
                    id,
                    title,
                    description,
                    category::text AS category,
                    location,
                    "imageUrl",
                    status::text AS status,
                    "dateLost" AS date,
                    1 - (embedding <=> ${vector}::vector) AS similarity
                FROM lost_items
                WHERE embedding IS NOT NULL
                  AND status IN ('OPEN', 'MATCHED')
                ORDER BY embedding <=> ${vector}::vector
                LIMIT ${perTableLimit}
            `)
            : Promise.resolve([] as VectorRow[]);

        const foundQuery = scope.includeFound
            ? prisma.$queryRaw<VectorRow[]>(Prisma.sql`
                SELECT
                    id,
                    title,
                    description,
                    category::text AS category,
                    location,
                    "imageUrl",
                    status::text AS status,
                    "dateFound" AS date,
                    1 - (embedding <=> ${vector}::vector) AS similarity
                FROM found_items
                WHERE embedding IS NOT NULL
                  AND status = 'AVAILABLE'
                ORDER BY embedding <=> ${vector}::vector
                LIMIT ${perTableLimit}
            `)
            : Promise.resolve([] as VectorRow[]);

        const [lostRows, foundRows] = await Promise.all([lostQuery, foundQuery]);

        const combined = [
            ...lostRows.map((row) => mapRow(row, "LOST")),
            ...foundRows.map((row) => mapRow(row, "FOUND")),
        ]
            .filter((match) => match.similarity >= envVars.CHATBOT_MIN_SIMILARITY)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, envVars.CHATBOT_TOP_K);

        return combined;
    },
};
