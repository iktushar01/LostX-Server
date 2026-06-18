import { prisma } from "../../lib/prisma";
import { envVars } from "../../../config/env";
import type { ChatbotMatch } from "./chatbot.interface";
import type { SearchScope } from "./chatbot.intent";
import {
    extractSearchTerms,
    phraseToCategoryHints,
    scoreKeywordMatch,
} from "./chatbot.utils";

const toMatch = (
    item: {
        id: string;
        title: string;
        description: string;
        category: string;
        location: string;
        imageUrl: string | null;
        status: string;
        dateLost?: Date;
        dateFound?: Date;
    },
    type: ChatbotMatch["type"],
    similarity: number,
): ChatbotMatch => ({
    id: item.id,
    type,
    title: item.title,
    description: item.description,
    category: item.category,
    location: item.location,
    imageUrl: item.imageUrl,
    status: item.status,
    date: new Date(item.dateLost ?? item.dateFound!).toISOString(),
    similarity,
    score: Math.round(similarity * 100),
});

export const KeywordSearchService = {
    search: async (
        query: string,
        scope: Pick<SearchScope, "includeLost" | "includeFound"> = {
            includeLost: true,
            includeFound: true,
        },
    ): Promise<ChatbotMatch[]> => {
        const terms = extractSearchTerms(query);
        const categoryHints = phraseToCategoryHints(query);

        if (terms.length === 0 && categoryHints.length === 0) {
            return [];
        }

        const orFilters = [
            ...terms.flatMap((term) => [
                { title: { contains: term, mode: "insensitive" as const } },
                { description: { contains: term, mode: "insensitive" as const } },
                { location: { contains: term, mode: "insensitive" as const } },
            ]),
            ...categoryHints.map((category) => ({
                category: category as import("../../lib/prisma-exports").ItemCategory,
            })),
        ];

        const [lostItems, foundItems] = await Promise.all([
            scope.includeLost
                ? prisma.lostItem.findMany({
                      where: {
                          status: { in: ["OPEN", "MATCHED"] },
                          OR: orFilters,
                      },
                      take: 20,
                      select: {
                          id: true,
                          title: true,
                          description: true,
                          category: true,
                          location: true,
                          imageUrl: true,
                          status: true,
                          dateLost: true,
                      },
                  })
                : Promise.resolve([]),
            scope.includeFound
                ? prisma.foundItem.findMany({
                      where: {
                          status: "AVAILABLE",
                          OR: orFilters,
                      },
                      take: 20,
                      select: {
                          id: true,
                          title: true,
                          description: true,
                          category: true,
                          location: true,
                          imageUrl: true,
                          status: true,
                          dateFound: true,
                      },
                  })
                : Promise.resolve([]),
        ]);

        const scored: ChatbotMatch[] = [
            ...lostItems.map((item) =>
                toMatch(
                    { ...item, category: item.category },
                    "LOST",
                    scoreKeywordMatch(item, terms, categoryHints, query),
                ),
            ),
            ...foundItems.map((item) =>
                toMatch(
                    { ...item, category: item.category },
                    "FOUND",
                    scoreKeywordMatch(item, terms, categoryHints, query),
                ),
            ),
        ]
            .filter((match) => match.similarity >= envVars.CHATBOT_MIN_SIMILARITY)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, envVars.CHATBOT_TOP_K);

        return scored;
    },
};
