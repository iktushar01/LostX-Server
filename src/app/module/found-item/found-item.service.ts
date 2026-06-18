import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { FoundItemStatus, ItemCategory, Role, ClaimStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { NotificationService } from "../notification/notification.service";
import { MatchService } from "../match/match.service";
import { EmbeddingService } from "../chatbot/embedding.service";
import { DuplicateService } from "../duplicate/duplicate.service";
import { buildLocationString } from "../../utils/location.util";
import { applyFoundItemLocationPrivacy } from "../../utils/item-privacy.util";
import { isStaffOrAdmin } from "../../utils/auth-roles.util";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../../lib/prisma-exports";

type CreateFoundItemPayload = {
    title: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string | null;
    location: string;
    building?: string | null;
    floor?: string | null;
    room?: string | null;
    dateFound: Date;
};

type UpdateFoundItemPayload = Partial<CreateFoundItemPayload>;

export const FoundItemService = {
    create: async (
        payload: CreateFoundItemPayload & { onBehalfOfUserId?: string },
        actorId: string,
        actorRole?: string,
    ) => {
        const { onBehalfOfUserId, ...itemPayload } = payload;
        const ownerId = onBehalfOfUserId ?? actorId;

        if (onBehalfOfUserId && !isStaffOrAdmin(actorRole ?? "")) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                "Only staff can register found items on behalf of others",
            );
        }

        const location = buildLocationString(itemPayload);

        await DuplicateService.assertNotDuplicateFound({
            userId: ownerId,
            title: itemPayload.title,
            category: itemPayload.category,
            location,
            eventDate: itemPayload.dateFound,
        });

        const item = await prisma.foundItem.create({
            data: {
                ...itemPayload,
                location,
                userId: ownerId,
                status: FoundItemStatus.AVAILABLE,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleFoundItemEmbedding(item.id);

        if (onBehalfOfUserId) {
            await AuditService.log({
                actorId,
                action: AuditAction.ITEM_REGISTERED_BY_STAFF,
                entityType: "found_item",
                entityId: item.id,
                metadata: { onBehalfOfUserId },
            });
        }

        return item;
    },

    getById: async (id: string, viewerUserId?: string, viewerRole?: string) => {
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

        const hasApprovedClaim =
            viewerUserId &&
            (await prisma.claim.findFirst({
                where: {
                    foundItemId: id,
                    userId: viewerUserId,
                    status: ClaimStatus.APPROVED,
                },
            }));

        const suggestedMatches = await MatchService.getSuggestionsForFoundItem(id);

        const isOwner = viewerUserId === item.userId;
        const isStaff = viewerRole ? isStaffOrAdmin(viewerRole) : false;

        const withPrivacy = applyFoundItemLocationPrivacy(item, {
            viewerUserId,
            isOwner,
            isStaffOrAdmin: isStaff,
            hasApprovedClaim: Boolean(hasApprovedClaim),
        });

        return { ...withPrivacy, suggestedMatches };
    },

    list: async (query: Record<string, unknown>, viewerUserId?: string, viewerRole?: string) => {
        const result = await new QueryBuilder(prisma.foundItem as import("../../interfaces/query.interface").PrismaModelDelegate, query, {
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

        const isStaff = viewerRole ? isStaffOrAdmin(viewerRole) : false;

        return {
            ...result,
            data: (result.data as CreateFoundItemPayload[]).map((item) => {
                const row = item as CreateFoundItemPayload & { id: string; userId: string };
                return applyFoundItemLocationPrivacy(row, {
                    viewerUserId,
                    isOwner: viewerUserId === row.userId,
                    isStaffOrAdmin: isStaff,
                });
            }),
        };
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

        const updated = await prisma.foundItem.update({
            where: { id },
            data: payload,
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleFoundItemEmbedding(updated.id);

        return updated;
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
        const isStaff = isStaffOrAdmin(userRole);

        if (!isOwner && !isStaff) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                "Only the finder or staff can mark this item as returned",
            );
        }

        const approvedClaim = item.claims[0];

        if (!isStaff && !approvedClaim?.receivedConfirmedAt) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "The claimant must confirm receipt before this item can be marked returned",
            );
        }

        const updated = await prisma.foundItem.update({
            where: { id },
            data: { status: FoundItemStatus.RETURNED },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        if (approvedClaim?.user) {
            await NotificationService.notifyItemReturned({
                userId: approvedClaim.user.id,
                userEmail: approvedClaim.user.email,
                userName: approvedClaim.user.name,
                itemTitle: item.title,
            });
        }

        await AuditService.log({
            actorId: userId,
            action: AuditAction.ITEM_RETURNED,
            entityType: "found_item",
            entityId: id,
        });

        return updated;
    },
};
