import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { FoundItemStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { QueryBuilder } from "../../utils/QueryBuilder";

type CreateFoundItemPayload = {
    title: string;
    description: string;
    category: string;
    imageUrl?: string | null;
    location: string;
    dateFound: Date;
};

export const FoundItemService = {
    create: async (payload: CreateFoundItemPayload, userId: string) => {
        return prisma.foundItem.create({
            data: {
                ...payload,
                userId,
                status: FoundItemStatus.AVAILABLE,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });
    },

    getById: async (id: string) => {
        const item = await prisma.foundItem.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                claims: {
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        return item;
    },

    list: async (query: Record<string, unknown>) => {
        return new QueryBuilder(prisma.foundItem, query, {
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

    listMine: async (userId: string, limit = 50) => {
        return prisma.foundItem.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                user: { select: { id: true, name: true } },
            },
        });
    },

    deleteOwn: async (id: string, userId: string) => {
        const item = await prisma.foundItem.findUnique({ where: { id } });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        if (item.userId !== userId) {
            throw new AppError(StatusCodes.FORBIDDEN, "You can only delete your own found items");
        }

        await prisma.foundItem.delete({ where: { id } });
        return { id };
    },
};
