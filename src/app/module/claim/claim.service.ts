import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import { ClaimStatus, FoundItemStatus, LostItemStatus, Role } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";

type CreateClaimPayload = {
    foundItemId: string;
    lostItemId: string;
    answer: string;
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
            verificationAnswer: true,
            status: true,
            category: true,
        },
    },
} as const;

export const ClaimService = {
    create: async (payload: CreateClaimPayload, userId: string) => {
        const [foundItem, lostItem] = await Promise.all([
            prisma.foundItem.findUnique({ where: { id: payload.foundItemId } }),
            prisma.lostItem.findUnique({ where: { id: payload.lostItemId } }),
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

        if (lostItem.status !== LostItemStatus.OPEN) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "This lost item report is no longer open for claims",
            );
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

        if (!lostItem.verificationQuestion?.trim()) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                "Selected lost item is missing a verification question",
            );
        }

        const existingClaim = await prisma.claim.findFirst({
            where: {
                foundItemId: payload.foundItemId,
                userId,
            },
        });

        if (existingClaim) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "You have already submitted a claim for this item",
            );
        }

        return prisma.claim.create({
            data: {
                foundItemId: payload.foundItemId,
                lostItemId: payload.lostItemId,
                userId,
                answer: payload.answer,
                status: ClaimStatus.PENDING,
            },
            include: {
                foundItem: true,
                lostItem: {
                    select: {
                        id: true,
                        title: true,
                        verificationQuestion: true,
                        status: true,
                    },
                },
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
        const where: import("../../../generated/prisma/index").Prisma.ClaimWhereInput = {};

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

    getById: async (claimId: string) => {
        const claim = await prisma.claim.findUnique({
            where: { id: claimId },
            include: claimInclude,
        });

        if (!claim) {
            throw new AppError(StatusCodes.NOT_FOUND, "Claim not found");
        }

        return claim;
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
            include: { foundItem: true, lostItem: true },
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
                include: claimInclude,
            });

            if (status === ClaimStatus.APPROVED) {
                await tx.foundItem.update({
                    where: { id: claim.foundItemId },
                    data: { status: FoundItemStatus.CLAIMED },
                });

                if (claim.lostItemId) {
                    await tx.lostItem.update({
                        where: { id: claim.lostItemId },
                        data: { status: LostItemStatus.RECOVERED },
                    });
                }

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
