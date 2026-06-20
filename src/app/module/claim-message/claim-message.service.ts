import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { ClaimStatus, Role } from "../../lib/prisma-exports.js";
import AppError from "../../errorHelpers/AppError.js";

const canAccessClaim = (
    claimUserId: string,
    finderUserId: string,
    currentUserId: string,
    currentRole: string,
) => {
    const isParticipant = claimUserId === currentUserId || finderUserId === currentUserId;
    const isAdmin = currentRole === Role.ADMIN || currentRole === Role.SUPER_ADMIN;
    return isParticipant || isAdmin;
};

const loadClaimForChat = async (claimId: string) => {
    const claim = await prisma.claim.findUnique({
        where: { id: claimId },
        include: {
            foundItem: { select: { id: true, userId: true, title: true } },
            user: { select: { id: true, name: true } },
        },
    });

    if (!claim) {
        throw new AppError(StatusCodes.NOT_FOUND, "Claim not found");
    }

    if (claim.status !== ClaimStatus.APPROVED) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            "Chat is available only after claim approval",
        );
    }

    return claim;
};

export const ClaimMessageService = {
    listByClaim: async (claimId: string, userId: string, userRole: string) => {
        const claim = await loadClaimForChat(claimId);

        if (!canAccessClaim(claim.userId, claim.foundItem.userId, userId, userRole)) {
            throw new AppError(StatusCodes.FORBIDDEN, "You cannot access this claim chat");
        }

        return prisma.claimMessage.findMany({
            where: { claimId },
            include: {
                sender: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
            take: 500,
        });
    },

    create: async (
        claimId: string,
        userId: string,
        userRole: string,
        content: string,
    ) => {
        const claim = await loadClaimForChat(claimId);

        if (!canAccessClaim(claim.userId, claim.foundItem.userId, userId, userRole)) {
            throw new AppError(StatusCodes.FORBIDDEN, "You cannot post in this claim chat");
        }

        return prisma.claimMessage.create({
            data: {
                claimId,
                senderId: userId,
                content: content.trim(),
            },
            include: {
                sender: { select: { id: true, name: true, email: true } },
            },
        });
    },
};

