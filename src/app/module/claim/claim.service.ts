import { randomBytes } from "crypto";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import {
    AuditAction,
    ClaimStatus,
    FoundItemStatus,
    ItemCategory,
    LostItemStatus,
} from "../../lib/prisma-exports.js";
import AppError from "../../errorHelpers/AppError.js";
import { isStaffOrAdmin } from "../../utils/auth-roles.util.js";
import { buildLocationString } from "../../utils/location.util.js";
import { AuditService } from "../audit/audit.service.js";
import { scoreLostFoundPair } from "../match/match.service.js";
import { NotificationService } from "../notification/notification.service.js";
import { decryptText } from "../../utils/encryption.util.js";
import {
    VerificationAiService,
    type AiVerificationAnswer,
    type AiVerificationQuestion,
} from "./verification-ai.service.js";
import { encryptIfPresent } from "../../utils/encryption.util.js";
import {
    defaultVisibilityForCategory,
    parseVisibilityFlag,
} from "../../utils/visibility-defaults.util.js";

type CreateClaimPayload = {
    foundItemId: string;
    lostItemId: string;
    answer?: string;
    aiQuestions?: AiVerificationQuestion[];
    aiAnswers?: AiVerificationAnswer[];
};

type QuickClaimPayload = {
    foundItemId: string;
    title: string;
    description: string;
    privateDescription: string;
    category: ItemCategory;
    location: string;
    building?: string;
    floor?: string;
    room?: string;
    dateLost: Date;
    showImagePublic?: boolean | string;
    showDescriptionPublic?: boolean | string;
    showLocationPublic?: boolean | string;
    aiQuestions: AiVerificationQuestion[];
    aiAnswers: AiVerificationAnswer[];
};

const claimInclude = {
    user: { select: { id: true, name: true, email: true } },
    foundItem: {
        include: {
            user: { select: { id: true, name: true, email: true } },
        },
    },
    lostItem: {
        select: {
            id: true,
            title: true,
            verificationQuestion: true,
            status: true,
            category: true,
        },
    },
} as const;

const generateHandoffCode = (): string => randomBytes(3).toString("hex").toUpperCase();

const getPrivatePlain = (
    encrypted: string | null | undefined,
    publicDescription: string,
): string => {
    if (encrypted?.trim()) {
        return decryptText(encrypted) ?? publicDescription;
    }
    return publicDescription;
};

const assertClaimPairAccess = async (
    foundItemId: string,
    lostItemId: string,
    userId: string,
) => {
    const [foundItem, lostItem] = await Promise.all([
        prisma.foundItem.findUnique({
            where: { id: foundItemId },
            include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.lostItem.findUnique({ where: { id: lostItemId } }),
    ]);

    if (!foundItem) {
        throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
    }

    if (!lostItem) {
        throw new AppError(StatusCodes.NOT_FOUND, "Lost item report not found");
    }

    if (lostItem.userId !== userId) {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            "You can only claim using your own lost item reports",
        );
    }

    if (lostItem.status !== LostItemStatus.OPEN && lostItem.status !== LostItemStatus.MATCHED) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            "This lost item report is no longer open for claims",
        );
    }

    if (foundItem.userId === userId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "You cannot claim your own found item");
    }

    if (foundItem.status !== FoundItemStatus.AVAILABLE) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            "This found item is no longer available for claims",
        );
    }

    return { foundItem, lostItem };
};

const computeMatchScore = (
    lost: {
        title: string;
        description: string;
        category: ItemCategory;
        location: string;
        dateLost: Date;
    },
    found: {
        title: string;
        description: string;
        category: ItemCategory;
        location: string;
        dateFound: Date;
    },
): number =>
    scoreLostFoundPair(
        { ...lost, id: "", status: "", imageUrl: null, dateLost: lost.dateLost },
        { ...found, id: "", status: "", imageUrl: null, dateFound: found.dateFound },
    );

const approveClaimInTransaction = async (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    claimId: string,
    foundItemId: string,
    lostItemId: string | null,
    options: { autoApproved: boolean; handoffCode: string },
) => {
    await tx.claim.update({
        where: { id: claimId },
        data: {
            status: ClaimStatus.APPROVED,
            autoApproved: options.autoApproved,
            handoffCode: options.handoffCode,
        },
    });

    await tx.foundItem.update({
        where: { id: foundItemId },
        data: { status: FoundItemStatus.CLAIMED },
    });

    if (lostItemId) {
        await tx.lostItem.update({
            where: { id: lostItemId },
            data: { status: LostItemStatus.RECOVERED },
        });
    }

    const otherPending = await tx.claim.findMany({
        where: {
            foundItemId,
            id: { not: claimId },
            status: ClaimStatus.PENDING,
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            foundItem: { select: { title: true } },
        },
    });

    if (otherPending.length > 0) {
        await tx.claim.updateMany({
            where: {
                foundItemId,
                id: { not: claimId },
                status: ClaimStatus.PENDING,
            },
            data: { status: ClaimStatus.REJECTED },
        });
    }

    return otherPending;
};

export const ClaimService = {
    generateVerificationQuestions: async (
        foundItemId: string,
        lostItemId: string,
        userId: string,
    ) => {
        const { foundItem, lostItem } = await assertClaimPairAccess(
            foundItemId,
            lostItemId,
            userId,
        );

        const lostPrivate = getPrivatePlain(lostItem.privateDescription, lostItem.description);
        const foundPrivate = getPrivatePlain(
            foundItem.privateDescription,
            foundItem.description,
        );

        const questions = await VerificationAiService.generateQuestions({
            lostTitle: lostItem.title,
            lostPublicDescription: lostItem.description,
            lostPrivateDetails: lostPrivate,
            foundTitle: foundItem.title,
            foundPublicDescription: foundItem.description,
            foundPrivateDetails: foundPrivate,
        });

        return { questions };
    },

    generateVerificationQuestionsPreview: async (
        foundItemId: string,
        lostDraft: {
            title: string;
            description: string;
            privateDescription: string;
        },
        userId: string,
    ) => {
        const foundItem = await prisma.foundItem.findUnique({ where: { id: foundItemId } });

        if (!foundItem) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        if (foundItem.userId === userId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "You cannot claim your own found item");
        }

        if (foundItem.status !== FoundItemStatus.AVAILABLE) {
            throw new AppError(StatusCodes.BAD_REQUEST, "This found item is no longer available");
        }

        const foundPrivate = getPrivatePlain(
            foundItem.privateDescription,
            foundItem.description,
        );

        const questions = await VerificationAiService.generateQuestions({
            lostTitle: lostDraft.title,
            lostPublicDescription: lostDraft.description,
            lostPrivateDetails: lostDraft.privateDescription,
            foundTitle: foundItem.title,
            foundPublicDescription: foundItem.description,
            foundPrivateDetails: foundPrivate,
        });

        return { questions };
    },

    create: async (payload: CreateClaimPayload, userId: string) => {
        const { foundItem, lostItem } = await assertClaimPairAccess(
            payload.foundItemId,
            payload.lostItemId,
            userId,
        );

        const usesAiFlow = Boolean(lostItem.privateDescription?.trim());

        let answerSummary = payload.answer?.trim() ?? "";
        let aiQuestions: AiVerificationQuestion[] | undefined;
        let aiAnswers: AiVerificationAnswer[] | undefined;
        let aiConfidence: number | undefined;
        let aiRecommendation: string | undefined;

        if (usesAiFlow) {
            if (!payload.aiQuestions?.length || !payload.aiAnswers?.length) {
                throw new AppError(
                    StatusCodes.BAD_REQUEST,
                    "AI verification answers are required for this lost report",
                );
            }

            aiQuestions = payload.aiQuestions;
            aiAnswers = payload.aiAnswers;

            const lostPrivate = getPrivatePlain(
                lostItem.privateDescription,
                lostItem.description,
            );
            const foundPrivate = getPrivatePlain(
                foundItem.privateDescription,
                foundItem.description,
            );

            const aiResult = await VerificationAiService.scoreAnswers({
                lostPrivateDetails: lostPrivate,
                foundPrivateDetails: foundPrivate,
                questions: aiQuestions,
                answers: aiAnswers,
            });

            aiConfidence = aiResult.confidence;
            aiRecommendation = aiResult.recommendation;
            answerSummary = aiAnswers.map((a) => `${a.id}: ${a.answer}`).join("\n");
        } else {
            if (!lostItem.verificationQuestion?.trim() || !lostItem.verificationAnswer?.trim()) {
                throw new AppError(
                    StatusCodes.BAD_REQUEST,
                    "Selected lost item is missing verification details",
                );
            }

            if (!answerSummary) {
                throw new AppError(StatusCodes.BAD_REQUEST, "Verification answer is required");
            }
        }

        const matchScore = computeMatchScore(lostItem, foundItem);

        const result = await prisma.$transaction(async (tx) => {
            const stillAvailable = await tx.foundItem.updateMany({
                where: {
                    id: payload.foundItemId,
                    status: FoundItemStatus.AVAILABLE,
                },
                data: {},
            });

            if (stillAvailable.count === 0) {
                throw new AppError(
                    StatusCodes.CONFLICT,
                    "This found item was just claimed by someone else",
                );
            }

            const claim = await tx.claim.create({
                data: {
                    foundItemId: payload.foundItemId,
                    lostItemId: payload.lostItemId,
                    userId,
                    answer: answerSummary,
                    status: ClaimStatus.PENDING,
                    matchScore,
                    ...(aiQuestions ? { aiQuestions } : {}),
                    ...(aiAnswers ? { aiAnswers } : {}),
                    ...(aiConfidence != null ? { aiConfidence } : {}),
                    ...(aiRecommendation ? { aiRecommendation } : {}),
                },
                include: claimInclude,
            });

            const finalClaim = await tx.claim.findUnique({
                where: { id: claim.id },
                include: claimInclude,
            });

            return { claim: finalClaim! };
        });

        await Promise.all([
            NotificationService.notifyClaimPending({
                claimId: result.claim.id,
                claimantName: result.claim.user.name,
                itemTitle: foundItem.title,
            }),
            NotificationService.notifyFinderNewClaim({
                finderId: foundItem.userId,
                finderEmail: foundItem.user.email,
                finderName: foundItem.user.name,
                itemTitle: foundItem.title,
                claimantName: result.claim.user.name,
                claimId: result.claim.id,
            }),
        ]);

        return result.claim;
    },

    createQuick: async (payload: QuickClaimPayload, userId: string) => {
        const foundItem = await prisma.foundItem.findUnique({
            where: { id: payload.foundItemId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        if (!foundItem) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        if (foundItem.userId === userId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "You cannot claim your own found item");
        }

        if (foundItem.status !== FoundItemStatus.AVAILABLE) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "This found item is no longer available for claims",
            );
        }

        const location = buildLocationString({
            building: payload.building ?? null,
            floor: payload.floor ?? null,
            room: payload.room ?? null,
            location: payload.location,
        });

        const defaults = defaultVisibilityForCategory(payload.category);
        const visibility = {
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

        const encryptedPrivate = encryptIfPresent(payload.privateDescription);
        const foundPrivate = getPrivatePlain(
            foundItem.privateDescription,
            foundItem.description,
        );

        const aiResult = await VerificationAiService.scoreAnswers({
            lostPrivateDetails: payload.privateDescription,
            foundPrivateDetails: foundPrivate,
            questions: payload.aiQuestions,
            answers: payload.aiAnswers,
        });

        const answerSummary = payload.aiAnswers.map((a) => `${a.id}: ${a.answer}`).join("\n");

        const lostStub = {
            title: payload.title,
            description: payload.description,
            privateDescription: encryptedPrivate,
            category: payload.category,
            location,
            building: payload.building ?? null,
            floor: payload.floor ?? null,
            room: payload.room ?? null,
            dateLost: payload.dateLost,
            ...visibility,
        };

        const matchScore = computeMatchScore(
            { ...lostStub, dateLost: payload.dateLost },
            foundItem,
        );

        const result = await prisma.$transaction(async (tx) => {
            const stillAvailable = await tx.foundItem.updateMany({
                where: { id: payload.foundItemId, status: FoundItemStatus.AVAILABLE },
                data: {},
            });

            if (stillAvailable.count === 0) {
                throw new AppError(
                    StatusCodes.CONFLICT,
                    "This found item was just claimed by someone else",
                );
            }

            const lostItem = await tx.lostItem.create({
                data: {
                    ...lostStub,
                    userId,
                    status: LostItemStatus.OPEN,
                },
            });

            const claim = await tx.claim.create({
                data: {
                    foundItemId: payload.foundItemId,
                    lostItemId: lostItem.id,
                    userId,
                    answer: answerSummary,
                    status: ClaimStatus.PENDING,
                    matchScore,
                    aiQuestions: payload.aiQuestions,
                    aiAnswers: payload.aiAnswers,
                    aiConfidence: aiResult.confidence,
                    aiRecommendation: aiResult.recommendation,
                },
                include: claimInclude,
            });

            const finalClaim = await tx.claim.findUnique({
                where: { id: claim.id },
                include: claimInclude,
            });

            return {
                claim: finalClaim!,
                lostItem,
                matchScore,
            };
        });

        await Promise.all([
            NotificationService.notifyClaimPending({
                claimId: result.claim.id,
                claimantName: result.claim.user.name,
                itemTitle: foundItem.title,
            }),
            NotificationService.notifyFinderNewClaim({
                finderId: foundItem.userId,
                finderEmail: foundItem.user.email,
                finderName: foundItem.user.name,
                itemTitle: foundItem.title,
                claimantName: result.claim.user.name,
                claimId: result.claim.id,
            }),
        ]);

        return result.claim;
    },

    confirmReceived: async (claimId: string, userId: string) => {
        const claim = await prisma.claim.findUnique({ where: { id: claimId } });

        if (!claim) {
            throw new AppError(StatusCodes.NOT_FOUND, "Claim not found");
        }

        if (claim.userId !== userId) {
            throw new AppError(StatusCodes.FORBIDDEN, "Only the claimant can confirm receipt");
        }

        if (claim.status !== ClaimStatus.APPROVED) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "Only approved claims can confirm receipt",
            );
        }

        if (claim.receivedConfirmedAt) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Receipt already confirmed");
        }

        const updated = await prisma.claim.update({
            where: { id: claimId },
            data: { receivedConfirmedAt: new Date() },
            include: claimInclude,
        });

        await AuditService.log({
            actorId: userId,
            action: AuditAction.CLAIM_RECEIVED_CONFIRMED,
            entityType: "claim",
            entityId: claimId,
        });

        return updated;
    },

    listMine: async (userId: string) => {
        return prisma.claim.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: {
                foundItem: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                },
                lostItem: {
                    select: {
                        id: true,
                        title: true,
                        verificationQuestion: true,
                        status: true,
                    },
                },
            },
        });
    },

    listAll: async (filters?: { search?: string; status?: ClaimStatus }) => {
        const where: import("../../../generated/prisma/index.js").Prisma.ClaimWhereInput = {};

        if (filters?.status) {
            where.status = filters.status;
        }

        if (filters?.search) {
            where.user = {
                OR: [
                    { name: { contains: filters.search, mode: "insensitive" } },
                    { email: { contains: filters.search, mode: "insensitive" } },
                ],
            };
        }

        return prisma.claim.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: claimInclude,
        });
    },

    getById: async (claimId: string, requesterUserId: string, requesterRole: string) => {
        const claim = await prisma.claim.findUnique({
            where: { id: claimId },
            include: {
                ...claimInclude,
                foundItem: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
                lostItem: true,
            },
        });

        if (!claim) {
            throw new AppError(StatusCodes.NOT_FOUND, "Claim not found");
        }

        const isAdmin = isStaffOrAdmin(requesterRole);
        const isParticipant =
            claim.userId === requesterUserId || claim.foundItem.userId === requesterUserId;

        if (!isAdmin && !isParticipant) {
            throw new AppError(StatusCodes.FORBIDDEN, "You cannot access this claim");
        }

        if (!isAdmin) {
            return claim;
        }

        const enrichItem = (
            item: {
                description: string;
                privateDescription?: string | null;
                [key: string]: unknown;
            } | null,
        ) => {
            if (!item) return null;
            const { privateDescription, ...rest } = item;
            return {
                ...rest,
                privateDescriptionPlain: getPrivatePlain(privateDescription, item.description),
            };
        };

        return {
            ...claim,
            foundItem: enrichItem(claim.foundItem),
            lostItem: enrichItem(claim.lostItem),
        };
    },

    updateStatus: async (
        claimId: string,
        status: typeof ClaimStatus.APPROVED | typeof ClaimStatus.REJECTED,
        adminUserId: string,
        adminRole: string,
    ) => {
        if (!isStaffOrAdmin(adminRole)) {
            throw new AppError(StatusCodes.FORBIDDEN, "Staff or admin access required");
        }

        const claim = await prisma.claim.findUnique({
            where: { id: claimId },
            include: {
                foundItem: true,
                lostItem: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });

        if (!claim) {
            throw new AppError(StatusCodes.NOT_FOUND, "Claim not found");
        }

        if (claim.status !== ClaimStatus.PENDING) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Only pending claims can be updated");
        }

        const handoffCode = status === ClaimStatus.APPROVED ? generateHandoffCode() : null;

        const { updatedClaim, superseded } = await prisma.$transaction(async (tx) => {
            const result = await tx.claim.update({
                where: { id: claimId },
                data: {
                    status,
                    handoffCode: status === ClaimStatus.APPROVED ? handoffCode : null,
                },
                include: claimInclude,
            });

            let rejectedOthers: Awaited<ReturnType<typeof approveClaimInTransaction>> = [];

            if (status === ClaimStatus.APPROVED) {
                rejectedOthers = await approveClaimInTransaction(
                    tx,
                    claimId,
                    claim.foundItemId,
                    claim.lostItemId,
                    { autoApproved: false, handoffCode: handoffCode! },
                );
            }

            return { updatedClaim: result, superseded: rejectedOthers };
        });

        await AuditService.log({
            actorId: adminUserId,
            action:
                status === ClaimStatus.APPROVED
                    ? AuditAction.CLAIM_APPROVED
                    : AuditAction.CLAIM_REJECTED,
            entityType: "claim",
            entityId: claimId,
            metadata: { matchScore: claim.matchScore },
        });

        if (status === ClaimStatus.APPROVED) {
            await NotificationService.notifyClaimApproved({
                userId: claim.userId,
                userEmail: claim.user.email,
                userName: claim.user.name,
                itemTitle: claim.foundItem.title,
                claimId: claim.id,
            });

            for (const other of superseded) {
                await NotificationService.notifyClaimRejected({
                    userId: other.userId,
                    userEmail: other.user.email,
                    userName: other.user.name,
                    itemTitle: other.foundItem.title,
                    reason: "Another claim was approved for this item.",
                });
            }
        } else {
            await NotificationService.notifyClaimRejected({
                userId: claim.userId,
                userEmail: claim.user.email,
                userName: claim.user.name,
                itemTitle: claim.foundItem.title,
                reason: "Your claim was reviewed and rejected by staff.",
            });
        }

        return updatedClaim;
    },
};
