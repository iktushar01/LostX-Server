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
};

export const LostItemService = {
    create: async (payload: CreateLostItemPayload, userId: string) => {
        return prisma.lostItem.create({
            data: {
                ...payload,
                userId,
                status: LostItemStatus.OPEN,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });
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

        return item;
    },

    list: async (query: Record<string, unknown>) => {
        return new QueryBuilder(prisma.lostItem, query, {
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
