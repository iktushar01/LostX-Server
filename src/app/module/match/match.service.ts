import { prisma } from "../../lib/prisma";
import { FoundItemStatus, ItemCategory, LostItemStatus } from "../../lib/prisma-exports";
import { NotificationService } from "../notification/notification.service";

export const MATCH_HIGH_THRESHOLD = 70;
export const MATCH_SUGGESTION_MIN = 35;
const MAX_SUGGESTIONS = 5;

const STOP_WORDS = new Set([
    "the", "a", "an", "at", "in", "on", "near", "by", "of", "and", "or", "to", "from",
]);

export type MatchableItem = {
    id: string;
    title: string;
    description: string;
    category: ItemCategory;
    location: string;
    dateLost?: Date;
    dateFound?: Date;
    imageUrl?: string | null;
    status: string;
};

export type ScoredMatch = {
    id: string;
    title: string;
    category: ItemCategory;
    location: string;
    imageUrl: string | null;
    score: number;
    itemType: "lost" | "found";
};

const tokenize = (text: string): string[] =>
    text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

const overlapRatio = (a: string[], b: string[]): number => {
    if (!a.length || !b.length) return 0;
    const setB = new Set(b);
    const overlap = a.filter((token) => setB.has(token)).length;
    return overlap / Math.max(a.length, b.length);
};

const dateProximityScore = (lostDate: Date, foundDate: Date): number => {
    const diffDays = Math.abs(lostDate.getTime() - foundDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 20;
    if (diffDays <= 3) return 15;
    if (diffDays <= 7) return 10;
    if (diffDays <= 14) return 5;
    return 0;
};

export const scoreLostFoundPair = (lost: MatchableItem, found: MatchableItem): number => {
    let score = 0;

    if (lost.category === found.category) {
        score += 40;
    }

    const locationTokens = [
        ...tokenize(lost.location),
        ...tokenize(lost.description),
    ];
    const foundLocationTokens = [
        ...tokenize(found.location),
        ...tokenize(found.description),
    ];
    score += Math.round(overlapRatio(locationTokens, foundLocationTokens) * 25);

    const lostDate = lost.dateLost;
    const foundDate = found.dateFound;
    if (lostDate && foundDate) {
        score += dateProximityScore(lostDate, foundDate);
    }

    const titleTokens = tokenize(lost.title);
    const foundTitleTokens = tokenize(found.title);
    score += Math.round(overlapRatio(titleTokens, foundTitleTokens) * 15);

    return Math.min(100, score);
};

const toScoredMatch = (
    item: MatchableItem,
    score: number,
    itemType: "lost" | "found",
): ScoredMatch => ({
    id: item.id,
    title: item.title,
    category: item.category,
    location: item.location,
    imageUrl: item.imageUrl ?? null,
    score,
    itemType,
});

export const MatchService = {
    scoreLostFoundPair,

    getSuggestionsForLostItem: async (lostItemId: string): Promise<ScoredMatch[]> => {
        const lostItem = await prisma.lostItem.findUnique({ where: { id: lostItemId } });
        if (!lostItem) return [];

        const foundItems = await prisma.foundItem.findMany({
            where: { status: FoundItemStatus.AVAILABLE },
            take: 200,
            orderBy: { createdAt: "desc" },
        });

        const lost: MatchableItem = { ...lostItem, dateLost: lostItem.dateLost };

        const scored = foundItems
            .map((found) => ({
                match: toScoredMatch(
                    { ...found, dateFound: found.dateFound },
                    scoreLostFoundPair(lost, { ...found, dateFound: found.dateFound }),
                    "found",
                ),
                score: scoreLostFoundPair(lost, { ...found, dateFound: found.dateFound }),
            }))
            .filter(({ score }) => score >= MATCH_SUGGESTION_MIN)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_SUGGESTIONS)
            .map(({ match }) => match);

        await MatchService.applyHighMatchStatus(lostItemId, scored);

        return scored;
    },

    getSuggestionsForFoundItem: async (foundItemId: string): Promise<ScoredMatch[]> => {
        const foundItem = await prisma.foundItem.findUnique({ where: { id: foundItemId } });
        if (!foundItem) return [];

        const lostItems = await prisma.lostItem.findMany({
            where: { status: { in: [LostItemStatus.OPEN, LostItemStatus.MATCHED] } },
            take: 200,
            orderBy: { createdAt: "desc" },
        });

        const found: MatchableItem = { ...foundItem, dateFound: foundItem.dateFound };

        return lostItems
            .map((lost) => ({
                match: toScoredMatch(
                    { ...lost, dateLost: lost.dateLost },
                    scoreLostFoundPair({ ...lost, dateLost: lost.dateLost }, found),
                    "lost",
                ),
                score: scoreLostFoundPair({ ...lost, dateLost: lost.dateLost }, found),
            }))
            .filter(({ score }) => score >= MATCH_SUGGESTION_MIN)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_SUGGESTIONS)
            .map(({ match }) => match);
    },

    getBrowseSuggestions: async () => {
        const [lostItems, foundItems] = await Promise.all([
            prisma.lostItem.findMany({
                where: { status: { in: [LostItemStatus.OPEN, LostItemStatus.MATCHED] } },
                take: 100,
                orderBy: { createdAt: "desc" },
            }),
            prisma.foundItem.findMany({
                where: { status: FoundItemStatus.AVAILABLE },
                take: 100,
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const byLostId: Record<string, ScoredMatch[]> = {};
        const byFoundId: Record<string, ScoredMatch[]> = {};

        for (const lost of lostItems) {
            const lostMatchable: MatchableItem = { ...lost, dateLost: lost.dateLost };
            const matches = foundItems
                .map((found) => {
                    const foundMatchable: MatchableItem = { ...found, dateFound: found.dateFound };
                    const score = scoreLostFoundPair(lostMatchable, foundMatchable);
                    return {
                        match: toScoredMatch(foundMatchable, score, "found"),
                        score,
                    };
                })
                .filter(({ score }) => score >= MATCH_SUGGESTION_MIN)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(({ match }) => match);

            if (matches.length > 0) {
                byLostId[lost.id] = matches;
                await MatchService.applyHighMatchStatus(lost.id, matches);
            }
        }

        for (const found of foundItems) {
            const foundMatchable: MatchableItem = { ...found, dateFound: found.dateFound };
            const matches = lostItems
                .map((lost) => {
                    const lostMatchable: MatchableItem = { ...lost, dateLost: lost.dateLost };
                    const score = scoreLostFoundPair(lostMatchable, foundMatchable);
                    return {
                        match: toScoredMatch(lostMatchable, score, "lost"),
                        score,
                    };
                })
                .filter(({ score }) => score >= MATCH_SUGGESTION_MIN)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(({ match }) => match);

            if (matches.length > 0) {
                byFoundId[found.id] = matches;
            }
        }

        return { byLostId, byFoundId };
    },

    applyHighMatchStatus: async (lostItemId: string, matches: ScoredMatch[]) => {
        const topMatch = matches[0];
        if (!topMatch || topMatch.score < MATCH_HIGH_THRESHOLD) return;

        const result = await prisma.lostItem.updateMany({
            where: { id: lostItemId, status: LostItemStatus.OPEN },
            data: { status: LostItemStatus.MATCHED },
        });

        if (result.count === 0) return;

        const lostItem = await prisma.lostItem.findUnique({
            where: { id: lostItemId },
            include: { user: { select: { id: true, email: true, name: true } } },
        });

        if (!lostItem) return;

        await NotificationService.notifyMatchFound({
            userId: lostItem.userId,
            userEmail: lostItem.user.email,
            userName: lostItem.user.name,
            lostItemTitle: lostItem.title,
            matchedItemTitle: topMatch.title,
            matchScore: topMatch.score,
            foundItemId: topMatch.id,
        });
    },
};
