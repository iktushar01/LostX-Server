import { StatusCodes } from "http-status-codes";

import { prisma } from "../../lib/prisma";

import { ItemCategory, LostItemStatus } from "../../lib/prisma-exports";

import AppError from "../../errorHelpers/AppError";

import { QueryBuilder } from "../../utils/QueryBuilder";

import { MatchService } from "../match/match.service";

import { EmbeddingService } from "../chatbot/embedding.service";

import { hashVerificationAnswer } from "../../utils/verification.util";

import { DuplicateService } from "../duplicate/duplicate.service";

import { buildLocationString } from "../../utils/location.util";

import { applyPublicItemPrivacy, type PublicItem } from "../../utils/item-privacy.util";

import { isStaffOrAdmin } from "../../utils/auth-roles.util";

import { encryptIfPresent } from "../../utils/encryption.util";

import { stripSecretFields, withDecryptedPrivateDescription } from "../../utils/item-secrets.util";

import {

    defaultVisibilityForCategory,

    parseVisibilityFlag,

} from "../../utils/visibility-defaults.util";



type CreateLostItemPayload = {

    title: string;

    description: string;

    privateDescription: string;

    category: ItemCategory;

    imageUrl?: string | null;

    location: string;

    building?: string | null;

    floor?: string | null;

    room?: string | null;

    dateLost: Date;

    showImagePublic?: boolean | string;

    showDescriptionPublic?: boolean | string;

    showLocationPublic?: boolean | string;

    verificationQuestion?: string;

    verificationAnswer?: string;

};



type UpdateLostItemPayload = Partial<CreateLostItemPayload>;



type LostItemRecord = {

    verificationAnswer?: string | null;

    privateDescription?: string | null;

    [key: string]: unknown;

};



const omitVerificationAnswer = <T extends LostItemRecord>(item: T) => {

    const { verificationAnswer: _answer, ...rest } = item;

    return rest;

};



const resolveVisibility = (

    category: ItemCategory,

    payload: Pick<

        CreateLostItemPayload,

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



export const LostItemService = {

    create: async (payload: CreateLostItemPayload, userId: string) => {

        const location = buildLocationString(payload);

        const visibility = resolveVisibility(payload.category, payload);

        const encryptedPrivate = encryptIfPresent(payload.privateDescription);



        await DuplicateService.assertNotDuplicateLost({

            userId,

            title: payload.title,

            category: payload.category,

            location,

            eventDate: payload.dateLost,

        });



        const hashedAnswer = payload.verificationAnswer?.trim()

            ? await hashVerificationAnswer(payload.verificationAnswer)

            : null;



        const item = await prisma.lostItem.create({

            data: {

                title: payload.title,

                description: payload.description,

                privateDescription: encryptedPrivate,

                category: payload.category,

                imageUrl: payload.imageUrl ?? null,

                location,

                building: payload.building ?? null,

                floor: payload.floor ?? null,

                room: payload.room ?? null,

                dateLost: payload.dateLost,

                verificationQuestion: payload.verificationQuestion?.trim() || null,

                verificationAnswer: hashedAnswer,

                ...visibility,

                userId,

                status: LostItemStatus.OPEN,

            },

            include: {

                user: { select: { id: true, name: true, email: true } },

            },

        });



        EmbeddingService.scheduleLostItemEmbedding(item.id);



        return stripSecretFields(omitVerificationAnswer(item));

    },



    getById: async (id: string, viewerUserId?: string, viewerRole?: string) => {

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

        const isOwner = viewerUserId === item.userId;

        const isStaff = viewerRole ? isStaffOrAdmin(viewerRole) : false;



        const base = omitVerificationAnswer(item);



        if (isOwner || isStaff) {

            return {

                ...withDecryptedPrivateDescription(stripSecretFields(base)),

                suggestedMatches,

            };

        }



        return {

            ...applyPublicItemPrivacy(stripSecretFields(base) as PublicItem, {

                viewerUserId,

                isOwner: false,

                isStaffOrAdmin: false,

            }),

            suggestedMatches,

        };

    },



    list: async (query: Record<string, unknown>, viewerUserId?: string, viewerRole?: string) => {

        const hasStatusFilter = query.status !== undefined && query.status !== "";



        const result = await new QueryBuilder(prisma.lostItem as import("../../interfaces/query.interface").PrismaModelDelegate, query, {

            searchableFields: ["title", "description", "location", "building"],

            filterableFields: ["category", "status", "isFeatured"],

        })

            .search()

            .filter()

            .where(

                hasStatusFilter

                    ? {}

                    : {

                          status: {

                              in: [LostItemStatus.OPEN, LostItemStatus.MATCHED],

                          },

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

            data: (result.data as LostItemRecord[]).map((item) => {

                const row = item as LostItemRecord & {

                    userId: string;

                    category: ItemCategory;

                    location: string;

                    title: string;

                    description: string;

                    imageUrl?: string | null;

                    showImagePublic?: boolean;

                    showDescriptionPublic?: boolean;

                    showLocationPublic?: boolean;

                };

                return applyPublicItemPrivacy(

                    stripSecretFields(omitVerificationAnswer(row)) as PublicItem,

                    {

                        viewerUserId,

                        isOwner: viewerUserId === row.userId,

                        isStaffOrAdmin: isStaff,

                    },

                );

            }),

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



        return items.map((item) =>

            withDecryptedPrivateDescription(stripSecretFields(omitVerificationAnswer(item))),

        );

    },



    listMineForClaim: async (userId: string) => {

        const items = await prisma.lostItem.findMany({

            where: {

                userId,

                status: { in: [LostItemStatus.OPEN, LostItemStatus.MATCHED] },

                OR: [

                    { privateDescription: { not: null } },

                    { verificationQuestion: { not: null } },

                ],

            },

            orderBy: { createdAt: "desc" },

            select: {

                id: true,

                title: true,

                category: true,

                status: true,

                verificationQuestion: true,

                privateDescription: true,

            },

        });



        return items.map(({ privateDescription: _p, ...rest }) => ({

            ...rest,

            hasPrivateDetails: Boolean(_p),

        }));

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



        const { verificationAnswer, privateDescription, category, ...restPayload } = payload;

        const data: Record<string, unknown> = { ...restPayload };



        if (privateDescription?.trim()) {

            data.privateDescription = encryptIfPresent(privateDescription);

        }



        if (category) {

            const visibility = resolveVisibility(category, payload);

            Object.assign(data, visibility);

        } else if (

            payload.showImagePublic !== undefined ||

            payload.showDescriptionPublic !== undefined ||

            payload.showLocationPublic !== undefined

        ) {

            const visibility = resolveVisibility(item.category, payload);

            Object.assign(data, visibility);

        }



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



        return withDecryptedPrivateDescription(

            stripSecretFields(omitVerificationAnswer(updated)),

        );

    },

};


