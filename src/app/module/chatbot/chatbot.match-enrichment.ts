import { prisma } from "../../lib/prisma.js";
import { LostItemStatus } from "../../lib/prisma-exports.js";
import { type MatchableItem, scoreLostFoundPair } from "../match/match.service.js";
import type { ChatbotMatch } from "./chatbot.interface.js";
import type { SearchIntent } from "./chatbot.intent.js";

const toMatchableLost = (item: {
    id: string;
    title: string;
    description: string;
    category: import("../../lib/prisma-exports.js").ItemCategory;
    location: string;
    dateLost: Date;
    imageUrl: string | null;
    status: string;
}): MatchableItem => ({
    ...item,
    dateLost: item.dateLost,
});

const toMatchableFound = (item: {
    id: string;
    title: string;
    description: string;
    category: import("../../lib/prisma-exports.js").ItemCategory;
    location: string;
    dateFound: Date;
    imageUrl: string | null;
    status: string;
}): MatchableItem => ({
    ...item,
    dateFound: item.dateFound,
});

/**
 * Enrich semantic chatbot matches with rule-based scores from MatchService
 * so chatbot, browse, and detail pages speak the same 0–100 language.
 */
export const enrichMatchesWithRuleScores = async (
    matches: ChatbotMatch[],
    userId: string | undefined,
    intent: SearchIntent,
): Promise<ChatbotMatch[]> => {
    if (matches.length === 0) return matches;

    const lostReports =
        userId && (intent === "USER_LOST" || intent === "GENERAL")
            ? await prisma.lostItem.findMany({
                  where: {
                      userId,
                      status: { in: [LostItemStatus.OPEN, LostItemStatus.MATCHED] },
                  },
                  select: {
                      id: true,
                      title: true,
                      description: true,
                      category: true,
                      location: true,
                      dateLost: true,
                      imageUrl: true,
                      status: true,
                  },
              })
            : [];

    const foundInventory =
        intent === "USER_FOUND" || intent === "LOOKING_FOR_OWNER" || intent === "GENERAL"
            ? await prisma.foundItem.findMany({
                  where: { status: "AVAILABLE" },
                  take: 200,
                  orderBy: { createdAt: "desc" },
                  select: {
                      id: true,
                      title: true,
                      description: true,
                      category: true,
                      location: true,
                      dateFound: true,
                      imageUrl: true,
                      status: true,
                  },
              })
            : [];

    return matches.map((match) => {
        let ruleScore = 0;

        if (match.type === "FOUND" && lostReports.length > 0) {
            const foundItem = foundInventory.find((f) => f.id === match.id) ?? {
                id: match.id,
                title: match.title,
                description: match.description,
                category: match.category as import("../../lib/prisma-exports.js").ItemCategory,
                location: match.location,
                dateFound: new Date(match.date),
                imageUrl: match.imageUrl,
                status: match.status,
            };

            const foundMatchable = toMatchableFound(foundItem);

            for (const lost of lostReports) {
                const pairScore = scoreLostFoundPair(
                    toMatchableLost(lost),
                    foundMatchable,
                );
                ruleScore = Math.max(ruleScore, pairScore);
            }
        }

        if (match.type === "LOST" && foundInventory.length > 0) {
            const lostItem = {
                id: match.id,
                title: match.title,
                description: match.description,
                category: match.category as import("../../lib/prisma-exports.js").ItemCategory,
                location: match.location,
                dateLost: new Date(match.date),
                imageUrl: match.imageUrl,
                status: match.status,
            };

            for (const found of foundInventory) {
                const pairScore = scoreLostFoundPair(
                    toMatchableLost(lostItem),
                    toMatchableFound(found),
                );
                ruleScore = Math.max(ruleScore, pairScore);
            }
        }

        const semanticScore = Math.round(match.similarity * 100);
        const score = ruleScore > 0 ? Math.max(ruleScore, semanticScore) : semanticScore;

        return { ...match, score };
    });
};
