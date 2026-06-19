import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { ClaimStatus, FoundItemStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";

type CreateReviewPayload = {
    claimId: string;
    rating: number;
    comment?: string;
};

const isHandoffComplete = async (claimId: string) => {
    const claim = await prisma.claim.findUnique({
        where: { id: claimId },
        include: { foundItem: { select: { status: true, userId: true } } },
    });

    if (!claim || claim.status !== ClaimStatus.APPROVED) {
        return null;
    }

    const complete =
        claim.receivedConfirmedAt != null ||
        claim.foundItem.status === FoundItemStatus.RETURNED;

    if (!complete) {
        return null;
    }

    return claim;
};

export const UserReviewService = {
    create: async (revieweeId: string, reviewerId: string, payload: CreateReviewPayload) => {
        if (revieweeId === reviewerId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "You cannot review yourself");
        }

        const claim = await isHandoffComplete(payload.claimId);
        if (!claim) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "Reviews are only allowed after a completed handoff on an approved claim",
            );
        }

        const isClaimant = claim.userId === reviewerId;
        const isFinder = claim.foundItem.userId === reviewerId;

        if (!isClaimant && !isFinder) {
            throw new AppError(StatusCodes.FORBIDDEN, "You are not part of this claim");
        }

        const expectedRevieweeId = isClaimant ? claim.foundItem.userId : claim.userId;
        if (expectedRevieweeId !== revieweeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Reviewee does not match this claim");
        }

        const existing = await prisma.userReview.findUnique({
            where: {
                claimId_reviewerId: {
                    claimId: payload.claimId,
                    reviewerId,
                },
            },
        });

        if (existing) {
            throw new AppError(StatusCodes.CONFLICT, "You already reviewed this handoff");
        }

        return prisma.userReview.create({
            data: {
                claimId: payload.claimId,
                reviewerId,
                revieweeId,
                rating: payload.rating,
                comment: payload.comment?.trim() || null,
            },
            include: {
                reviewer: { select: { id: true, name: true, image: true } },
            },
        });
    },

    listForUser: async (userId: string, page = 1, limit = 10) => {
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            prisma.userReview.findMany({
                where: { revieweeId: userId },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    reviewer: { select: { id: true, name: true, image: true } },
                },
            }),
            prisma.userReview.count({ where: { revieweeId: userId } }),
        ]);

        return {
            data: reviews.map((review) => ({
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                reviewer: {
                    id: review.reviewer.id,
                    name: review.reviewer.name,
                    image: review.reviewer.image,
                },
            })),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    },

    getEligibleClaimsForReview: async (userId: string, revieweeId: string) => {
        const claims = await prisma.claim.findMany({
            where: {
                status: ClaimStatus.APPROVED,
                AND: [
                    { OR: [{ userId }, { foundItem: { userId } }] },
                    {
                        OR: [
                            { receivedConfirmedAt: { not: null } },
                            { foundItem: { status: FoundItemStatus.RETURNED } },
                        ],
                    },
                ],
            },
            include: {
                foundItem: { select: { id: true, title: true, userId: true } },
                user: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 20,
        });

        const reviewed = await prisma.userReview.findMany({
            where: { reviewerId: userId, revieweeId },
            select: { claimId: true },
        });
        const reviewedIds = new Set(reviewed.map((r) => r.claimId));

        return claims
            .filter((claim) => {
                const otherPartyId =
                    claim.userId === userId ? claim.foundItem.userId : claim.userId;
                return otherPartyId === revieweeId && !reviewedIds.has(claim.id);
            })
            .map((claim) => ({
                claimId: claim.id,
                itemTitle: claim.foundItem.title,
            }));
    },
};
