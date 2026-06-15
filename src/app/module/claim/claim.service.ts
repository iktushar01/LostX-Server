import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { ClaimStatus, FoundItemStatus, Role } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";

type CreateClaimPayload = {
    foundItemId: string;
    message: string;
};

export const ClaimService = {
    create: async (payload: CreateClaimPayload, userId: string) => {
        const foundItem = await prisma.foundItem.findUnique({
            where: { id: payload.foundItemId },
        });

        if (!foundItem) {
            throw new AppError(StatusCodes.NOT_FOUND, "Found item not found");
        }

        if (foundItem.userId === userId) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "You cannot claim your own found item",
            );
        }

        if (foundItem.status !== FoundItemStatus.AVAILABLE) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "This found item is no longer available for claims",
            );
        }

        const existingClaim = await prisma.claim.findFirst({
            where: {
                foundItemId: payload.foundItemId,
                userId,
                status: ClaimStatus.PENDING,
            },
        });

        if (existingClaim) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "You already have a pending claim for this item",
            );
        }

        return prisma.claim.create({
            data: {
                foundItemId: payload.foundItemId,
                userId,
                message: payload.message,
                status: ClaimStatus.PENDING,
            },
            include: {
                foundItem: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
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
            },
        });
    },

    listAll: async () => {
        return prisma.claim.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, name: true, email: true } },
                foundItem: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
    },

    updateStatus: async (
        claimId: string,
        status: typeof ClaimStatus.APPROVED | typeof ClaimStatus.REJECTED,
        adminRole: string,
    ) => {
        if (adminRole !== Role.ADMIN && adminRole !== Role.SUPER_ADMIN) {
            throw new AppError(StatusCodes.FORBIDDEN, "Admin access required");
        }

        const claim = await prisma.claim.findUnique({
            where: { id: claimId },
            include: { foundItem: true },
        });

        if (!claim) {
            throw new AppError(StatusCodes.NOT_FOUND, "Claim not found");
        }

        if (claim.status !== ClaimStatus.PENDING) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "Only pending claims can be updated",
            );
        }

        return prisma.$transaction(async (tx) => {
            const updatedClaim = await tx.claim.update({
                where: { id: claimId },
                data: { status },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    foundItem: true,
                },
            });

            if (status === ClaimStatus.APPROVED) {
                await tx.foundItem.update({
                    where: { id: claim.foundItemId },
                    data: { status: FoundItemStatus.CLAIMED },
                });

                await tx.claim.updateMany({
                    where: {
                        foundItemId: claim.foundItemId,
                        id: { not: claimId },
                        status: ClaimStatus.PENDING,
                    },
                    data: { status: ClaimStatus.REJECTED },
                });
            }

            return updatedClaim;
        });
    },
};
