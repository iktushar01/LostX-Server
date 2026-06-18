import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { FoundItemStatus, ItemCategory, Role, ClaimStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { NotificationService } from "../notification/notification.service";
import { MatchService } from "../match/match.service";

type CreateFoundItemPayload = {
    title: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string | null;
    location: string;
    dateFound: Date;
};

type UpdateFoundItemPayload = Partial<CreateFoundItemPayload>;

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

        const suggestedMatches = await MatchService.getSuggestionsForFoundItem(id);

        return { ...item, suggestedMatches };
    },

    list: async (query: Record<string, unknown>) => {
        return new QueryBuilder(prisma.foundItem as import("../../interfaces/query.interface").PrismaModelDelegate, query, {
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

    updateOwn: async (
        id: string,
        userId: string,
        payload: UpdateFoundItemPayload,
    ) => {
        const item = await prisma.foundItem.findUnique({ where: { id } });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        if (item.userId !== userId) {
            throw new AppError(StatusCodes.FORBIDDEN, "You can only edit your own found items");
        }

        const claimCount = await prisma.claim.count({
            where: { foundItemId: id },
        });

        if (claimCount > 0) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "You cannot edit this report because claims already exist for it",
            );
        }

        return prisma.foundItem.update({
            where: { id },
            data: payload,
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });
    },

    markReturned: async (id: string, userId: string, userRole: string) => {
        const item = await prisma.foundItem.findUnique({
            where: { id },
            include: {
                claims: {
                    where: { status: ClaimStatus.APPROVED },
                    take: 1,
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });

        if (!item) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        if (item.status !== FoundItemStatus.CLAIMED) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "Only claimed items can be marked as returned",
            );
        }

        const isOwner = item.userId === userId;
        const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

        if (!isOwner && !isAdmin) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                "Only the finder or an admin can mark this item as returned",
            );
        }

        const updated = await prisma.foundItem.update({
            where: { id },
            data: { status: FoundItemStatus.RETURNED },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        const approvedClaim = item.claims[0];
        if (approvedClaim?.user) {
            await NotificationService.notifyItemReturned({
                userId: approvedClaim.user.id,
                userEmail: approvedClaim.user.email,
                userName: approvedClaim.user.name,
                itemTitle: item.title,
            });
        }

        return updated;
    },
};
