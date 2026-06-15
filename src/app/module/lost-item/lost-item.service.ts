import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { LostItemStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { QueryBuilder } from "../../utils/QueryBuilder";

type CreateLostItemPayload = {
    title: string;
    description: string;
    category: string;
    imageUrl?: string | null;
    location: string;
    dateLost: Date;
    verificationQuestion: string;
    verificationAnswer: string;
};

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
        const item = await prisma.lostItem.create({
            data: {
                ...payload,
                userId,
                status: LostItemStatus.OPEN,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

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

        return omitVerificationAnswer(item);
    },

    list: async (query: Record<string, unknown>) => {
        const result = await new QueryBuilder(prisma.lostItem, query, {
            searchableFields: ["title", "description", "location"],
            filterableFields: ["category", "status"],
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
                status: LostItemStatus.OPEN,
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
};
