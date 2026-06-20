import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { FoundItemStatus, ItemCategory, Role, ClaimStatus, LostItemStatus } from "../../lib/prisma-exports.js";
import AppError from "../../errorHelpers/AppError.js";
import { QueryBuilder } from "../../utils/QueryBuilder.js";
import { NotificationService } from "../notification/notification.service.js";
import { MatchService } from "../match/match.service.js";
import { EmbeddingService } from "../chatbot/embedding.service.js";
import { DuplicateService } from "../duplicate/duplicate.service.js";
import { buildLocationString } from "../../utils/location.util.js";
import { applyFoundItemLocationPrivacy, type PublicItem } from "../../utils/item-privacy.util.js";
import { isStaffOrAdmin } from "../../utils/auth-roles.util.js";
import { AuditService } from "../audit/audit.service.js";
import { AuditAction } from "../../lib/prisma-exports.js";
import { encryptIfPresent } from "../../utils/encryption.util.js";
import { stripSecretFields, withDecryptedPrivateDescription } from "../../utils/item-secrets.util.js";
import {
    defaultVisibilityForCategory,
    parseVisibilityFlag,
} from "../../utils/visibility-defaults.util.js";

type CreateFoundItemPayload = {
    title: string;
    description: string;
    privateDescription: string;
    category: ItemCategory;
    imageUrl?: string | null;
    location: string;
    building?: string | null;
    floor?: string | null;
    room?: string | null;
    dateFound: Date;
    showImagePublic?: boolean | string;
    showDescriptionPublic?: boolean | string;
    showLocationPublic?: boolean | string;
    linkedLostItemId?: string;
};

type FinderTipPayload = {
    note?: string;
    location: string;
    building?: string | null;
    floor?: string | null;
    room?: string | null;
    dateFound: Date;
    imageUrl?: string | null;
};

type UpdateFoundItemPayload = Partial<CreateFoundItemPayload>;

const resolveVisibility = (
    category: ItemCategory,
    payload: Pick<
        CreateFoundItemPayload,
        "showImagePublic" | "showDescriptionPublic" | "showLocationPublic"
    >,
) => {
    const defaults = defaultVisibilityForCategory(category);
    return {
        showImagePublic: parseVisibilityFlag(payload.showImagePublic, defaults.showImagePublic),
        showDescriptionPublic: parseVisibilityFlag(
            payload.showDescriptionPublic,
            defaults.showDescriptionPublic,
        ),
        showLocationPublic: parseVisibilityFlag(
            payload.showLocationPublic,
            defaults.showLocationPublic,
        ),
    };
};

const assertLinkedLostItem = async (linkedLostItemId: string, finderId: string) => {
    const lostItem = await prisma.lostItem.findUnique({
        where: { id: linkedLostItemId },
        select: { id: true, userId: true, status: true, title: true, category: true },
    });

    if (!lostItem) {
        throw new AppError(StatusCodes.NOT_FOUND, "Linked lost report not found");
    }

    if (lostItem.userId === finderId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "You cannot link a found report to your own lost report");
    }

    if (lostItem.status !== LostItemStatus.OPEN && lostItem.status !== LostItemStatus.MATCHED) {
        throw new AppError(StatusCodes.BAD_REQUEST, "This lost report is no longer open for finder tips");
    }

    return lostItem;
};

export const FoundItemService = {
    create: async (
        payload: CreateFoundItemPayload & { onBehalfOfUserId?: string },
        actorId: string,
        actorRole?: string,
    ) => {
        const { onBehalfOfUserId, linkedLostItemId, ...itemPayload } = payload;
        const ownerId = onBehalfOfUserId ?? actorId;

        if (onBehalfOfUserId && !isStaffOrAdmin(actorRole ?? "")) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                "Only staff can register found items on behalf of others",
            );
        }

        if (linkedLostItemId) {
            await assertLinkedLostItem(linkedLostItemId, ownerId);
        }

        const location = buildLocationString(itemPayload);
        const visibility = resolveVisibility(itemPayload.category, itemPayload);
        const encryptedPrivate = encryptIfPresent(itemPayload.privateDescription);

        await DuplicateService.assertNotDuplicateFound({
            userId: ownerId,
            title: itemPayload.title,
            category: itemPayload.category,
            location,
            eventDate: itemPayload.dateFound,
        });

        const item = await prisma.foundItem.create({
            data: {
                title: itemPayload.title,
                description: itemPayload.description,
                privateDescription: encryptedPrivate,
                category: itemPayload.category,
                imageUrl: itemPayload.imageUrl ?? null,
                location,
                building: itemPayload.building ?? null,
                floor: itemPayload.floor ?? null,
                room: itemPayload.room ?? null,
                dateFound: itemPayload.dateFound,
                ...visibility,
                userId: ownerId,
                status: FoundItemStatus.AVAILABLE,
                linkedLostItemId: linkedLostItemId ?? null,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleFoundItemEmbedding(item.id);

        await MatchService.notifyLostOwnersForFoundItem({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            location: item.location,
            dateFound: item.dateFound,
            linkedLostItemId: item.linkedLostItemId,
        });

        if (onBehalfOfUserId) {
            await AuditService.log({
                actorId,
                action: AuditAction.ITEM_REGISTERED_BY_STAFF,
                entityType: "found_item",
                entityId: item.id,
                metadata: { onBehalfOfUserId },
            });
        }

        return stripSecretFields(item);
    },

    createFromLostTip: async (
        lostItemId: string,
        payload: FinderTipPayload,
        finderId: string,
    ) => {
        const lostItem = await prisma.lostItem.findUnique({
            where: { id: lostItemId },
            select: {
                id: true,
                title: true,
                category: true,
                userId: true,
                status: true,
            },
        });

        if (!lostItem) {
            throw new AppError(StatusCodes.NOT_FOUND, "Lost item not found");
        }

        if (lostItem.userId === finderId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "You cannot report finding your own lost item");
        }

        if (lostItem.status !== LostItemStatus.OPEN && lostItem.status !== LostItemStatus.MATCHED) {
            throw new AppError(StatusCodes.BAD_REQUEST, "This lost report is no longer open");
        }

        const existingTip = await prisma.foundItem.findFirst({
            where: {
                userId: finderId,
                linkedLostItemId: lostItemId,
                status: FoundItemStatus.AVAILABLE,
            },
            select: { id: true },
        });

        if (existingTip) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "You already reported that you may have found this item",
            );
        }

        const note = payload.note?.trim() ?? "";
        const location = buildLocationString(payload);
        const visibility = resolveVisibility(lostItem.category, {});
        const privateText =
            note.length >= 10
                ? note
                : `Finder tip linked to lost report: ${lostItem.title}`;

        const item = await prisma.foundItem.create({
            data: {
                title: `Found: ${lostItem.title}`,
                description: note || `Someone may have found: ${lostItem.title}`,
                privateDescription: encryptIfPresent(privateText),
                category: lostItem.category,
                imageUrl: payload.imageUrl ?? null,
                location,
                building: payload.building ?? null,
                floor: payload.floor ?? null,
                room: payload.room ?? null,
                dateFound: payload.dateFound,
                ...visibility,
                userId: finderId,
                status: FoundItemStatus.AVAILABLE,
                linkedLostItemId: lostItemId,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleFoundItemEmbedding(item.id);

        await MatchService.notifyLostOwnersForFoundItem({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            location: item.location,
            dateFound: item.dateFound,
            linkedLostItemId: lostItemId,
        });

        return stripSecretFields(item);
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

        const withPrivacy = applyFoundItemLocationPrivacy(
            stripSecretFields(item) as PublicItem,
            {
                viewerUserId,
                isOwner,
                isStaffOrAdmin: isStaff,
                hasApprovedClaim: Boolean(hasApprovedClaim),
            },
        );

        if (isOwner || isStaff) {
            return {
                ...withDecryptedPrivateDescription(withPrivacy),
                suggestedMatches,
            };
        }

        return { ...withPrivacy, suggestedMatches };
    },

    list: async (query: Record<string, unknown>, viewerUserId?: string, viewerRole?: string) => {
        const hasStatusFilter = query.status !== undefined && query.status !== "";

        const result = await new QueryBuilder(prisma.foundItem as import("../../interfaces/query.interface.js").PrismaModelDelegate, query, {
            searchableFields: ["title", "description", "location"],
            filterableFields: ["category", "status", "isFeatured"],
        })
            .search()
            .filter()
            .where(
                hasStatusFilter
                    ? {}
                    : {
                          status: FoundItemStatus.AVAILABLE,
                      },
            )
            .sort()
            .paginate()
            .include({
                user: { select: { id: true, name: true, image: true } },
            })
            .execute();

        const isStaff = viewerRole ? isStaffOrAdmin(viewerRole) : false;

        return {
            ...result,
            data: (result.data as CreateFoundItemPayload[]).map((item) => {
                const row = item as CreateFoundItemPayload & {
                    id: string;
                    userId: string;
                    showImagePublic?: boolean;
                    showDescriptionPublic?: boolean;
                    showLocationPublic?: boolean;
                };
                return applyFoundItemLocationPrivacy(stripSecretFields(row) as PublicItem, {
                    viewerUserId,
                    isOwner: viewerUserId === row.userId,
                    isStaffOrAdmin: isStaff,
                });
            }),
        };
    },

    listMine: async (userId: string, limit = 50) => {
        const items = await prisma.foundItem.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                user: { select: { id: true, name: true } },
            },
        });

        return items.map((item) =>
            withDecryptedPrivateDescription(stripSecretFields(item)),
        );
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

        const { privateDescription, category, ...restPayload } = payload;
        const data: Record<string, unknown> = { ...restPayload };

        if (privateDescription?.trim()) {
            data.privateDescription = encryptIfPresent(privateDescription);
        }

        if (category) {
            Object.assign(data, resolveVisibility(category, payload));
        } else if (
            payload.showImagePublic !== undefined ||
            payload.showDescriptionPublic !== undefined ||
            payload.showLocationPublic !== undefined
        ) {
            Object.assign(data, resolveVisibility(item.category, payload));
        }

        const updated = await prisma.foundItem.update({
            where: { id },
            data,
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        EmbeddingService.scheduleFoundItemEmbedding(updated.id);

        return withDecryptedPrivateDescription(stripSecretFields(updated));
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
