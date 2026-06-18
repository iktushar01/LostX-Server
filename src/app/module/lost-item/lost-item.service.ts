import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { ItemCategory, LostItemStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { MatchService } from "../match/match.service";
import { EmbeddingService } from "../chatbot/embedding.service";
import { hashVerificationAnswer } from "../../utils/verification.util";

type CreateLostItemPayload = {
    title: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string | null;
    location: string;
    dateLost: Date;
    verificationQuestion: string;
    verificationAnswer: string;
};

type UpdateLostItemPayload = Partial<CreateLostItemPayload>;

type LostItemRecord = {
    verificationAnswer?: string | null;
    [key: string]: unknown;
};

const omitVerificationAnswer = <T extends LostItemRecord>(item: T) => {
    const { verificationAnswer: _answer, ...rest } = item;
    return rest;
};

export const LostItemService = {
    create: async (payload: CreateLostItemPayload, userId: string) => {
        const hashedAnswer = await hashVerificationAnswer(payload.verificationAnswer);

        const item = await prisma.lostItem.create({
            data: {
                ...payload,
                verificationAnswer: hashedAnswer,
                userId,
                status: LostItemStatus.OPEN,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleLostItemEmbedding(item.id);

        return omitVerificationAnswer(item);
    },

    getById: async (id: string) => {
        const item = await prisma.lostItem.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Lost item not found");
        }

        const suggestedMatches = await MatchService.getSuggestionsForLostItem(id);

        return { ...omitVerificationAnswer(item), suggestedMatches };
    },

    list: async (query: Record<string, unknown>) => {
        const result = await new QueryBuilder(prisma.lostItem as import("../../interfaces/query.interface").PrismaModelDelegate, query, {
            searchableFields: ["title", "description", "location"],
            filterableFields: ["category", "status", "isFeatured"],
        })
            .search()
            .filter()
            .sort()
            .paginate()
            .include({
                user: { select: { id: true, name: true } },
            })
            .execute();

        return {
            ...result,
            data: (result.data as LostItemRecord[]).map(omitVerificationAnswer),
        };
    },

    listMine: async (userId: string, limit = 50) => {
        const items = await prisma.lostItem.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                user: { select: { id: true, name: true } },
            },
        });

        return items.map(omitVerificationAnswer);
    },

    listMineForClaim: async (userId: string) => {
        return prisma.lostItem.findMany({
            where: {
                userId,
                status: { in: [LostItemStatus.OPEN, LostItemStatus.MATCHED] },
                verificationQuestion: { not: null },
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                category: true,
                status: true,
                verificationQuestion: true,
            },
        });
    },

    deleteOwn: async (id: string, userId: string) => {
        const item = await prisma.lostItem.findUnique({ where: { id } });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Lost item not found");
        }

        if (item.userId !== userId) {
            throw new AppError(StatusCodes.FORBIDDEN, "You can only delete your own lost items");
        }

        await prisma.lostItem.delete({ where: { id } });
        return { id };
    },

    updateOwn: async (
        id: string,
        userId: string,
        payload: UpdateLostItemPayload,
    ) => {
        const item = await prisma.lostItem.findUnique({ where: { id } });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Lost item not found");
        }

        if (item.userId !== userId) {
            throw new AppError(StatusCodes.FORBIDDEN, "You can only edit your own lost items");
        }

        const claimCount = await prisma.claim.count({
            where: { lostItemId: id },
        });

        if (claimCount > 0) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "You cannot edit this report because claims already exist for it",
            );
        }

        const { verificationAnswer, ...restPayload } = payload;
        const data: UpdateLostItemPayload = { ...restPayload };

        if (verificationAnswer?.trim()) {
            data.verificationAnswer = await hashVerificationAnswer(verificationAnswer);
        }

        const updated = await prisma.lostItem.update({
            where: { id },
            data,
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleLostItemEmbedding(updated.id);

        return omitVerificationAnswer(updated);
    },
};
