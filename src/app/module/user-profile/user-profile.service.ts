import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import {
    ClaimStatus,
    FoundItemStatus,
    LostItemStatus,
    UserStatus,
} from "../../lib/prisma-exports.js";
import AppError from "../../errorHelpers/AppError.js";
import { UserTrustService } from "../user-trust/user-trust.service.js";

const DELETED_NAME = "Deleted user";

export const UserProfileService = {
    getAccountSummary: async (userId: string) => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                createdAt: true,
                status: true,
                isDeleted: true,
            },
        });

        if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
            throw new AppError(StatusCodes.NOT_FOUND, "Account not found");
        }

        const hasCredentialLogin = Boolean(
            await prisma.account.findFirst({
                where: { userId, providerId: "credential" },
                select: { id: true },
            }),
        );

        const [lostReports, foundReports, recoveredItems, approvedClaims, pendingClaims, successfulHandoffs] =
            await Promise.all([
                prisma.lostItem.count({ where: { userId } }),
                prisma.foundItem.count({ where: { userId } }),
                prisma.lostItem.count({ where: { userId, status: LostItemStatus.RECOVERED } }),
                prisma.claim.count({ where: { userId, status: ClaimStatus.APPROVED } }),
                prisma.claim.count({ where: { userId, status: ClaimStatus.PENDING } }),
                prisma.claim.count({
                    where: {
                        status: ClaimStatus.APPROVED,
                        AND: [
                            {
                                OR: [
                                    { receivedConfirmedAt: { not: null } },
                                    { foundItem: { status: FoundItemStatus.RETURNED } },
                                ],
                            },
                            {
                                OR: [{ userId }, { foundItem: { userId } }],
                            },
                        ],
                    },
                }),
            ]);

        const trust = await UserTrustService.computeTrust(userId);

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image,
                memberSince: user.createdAt,
            },
            stats: {
                lostReports,
                foundReports,
                recoveredItems,
                approvedClaims,
                pendingClaims,
                successfulHandoffs,
            },
            trust,
            hasCredentialLogin,
        };
    },

    getPublicProfile: async (targetUserId: string, viewerUserId: string) => {
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                name: true,
                image: true,
                createdAt: true,
                emailVerified: true,
                status: true,
                isDeleted: true,
            },
        });

        if (!user) {
            throw new AppError(StatusCodes.NOT_FOUND, "User not found");
        }

        const unavailable =
            user.isDeleted ||
            user.status === UserStatus.DELETED ||
            user.status === UserStatus.SUSPENDED;

        if (unavailable) {
            return {
                available: false as const,
                id: user.id,
                message: "Account unavailable",
            };
        }

        const [lostReports, foundReports, recoveredItems, successfulHandoffs, reviewAgg, lostRecent, foundRecent] =
            await Promise.all([
                prisma.lostItem.count({ where: { userId: targetUserId } }),
                prisma.foundItem.count({ where: { userId: targetUserId } }),
                prisma.lostItem.count({
                    where: { userId: targetUserId, status: LostItemStatus.RECOVERED },
                }),
                prisma.claim.count({
                    where: {
                        status: ClaimStatus.APPROVED,
                        AND: [
                            {
                                OR: [
                                    { receivedConfirmedAt: { not: null } },
                                    { foundItem: { status: FoundItemStatus.RETURNED } },
                                ],
                            },
                            {
                                OR: [{ userId: targetUserId }, { foundItem: { userId: targetUserId } }],
                            },
                        ],
                    },
                }),
                prisma.userReview.aggregate({
                    where: { revieweeId: targetUserId },
                    _avg: { rating: true },
                    _count: { id: true },
                }),
                prisma.lostItem.findMany({
                    where: { userId: targetUserId },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    select: { id: true, title: true, category: true, status: true, createdAt: true },
                }),
                prisma.foundItem.findMany({
                    where: { userId: targetUserId },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    select: { id: true, title: true, category: true, status: true, createdAt: true },
                }),
            ]);

        const trust = await UserTrustService.computeTrust(targetUserId);
        const reviewCount = reviewAgg._count.id;
        const averageRating =
            reviewCount >= 3 && reviewAgg._avg.rating != null
                ? Math.round(reviewAgg._avg.rating * 10) / 10
                : null;

        const recentActivity = [
            ...lostRecent.map((item) => ({
                id: item.id,
                type: "lost" as const,
                title: item.title,
                category: item.category,
                status: item.status,
                createdAt: item.createdAt,
            })),
            ...foundRecent.map((item) => ({
                id: item.id,
                type: "found" as const,
                title: item.title,
                category: item.category,
                status: item.status,
                createdAt: item.createdAt,
            })),
        ]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5);

        return {
            available: true as const,
            id: user.id,
            name: user.name === DELETED_NAME ? "Campus member" : user.name,
            image: user.image,
            memberSince: user.createdAt,
            emailVerified: user.emailVerified,
            stats: {
                lostReports,
                foundReports,
                recoveredItems,
                successfulHandoffs,
            },
            trust: {
                score: trust.score,
                tier: trust.tier,
                signals: trust.signals,
            },
            reviews:
                reviewCount >= 3
                    ? { averageRating, count: reviewCount }
                    : { averageRating: null, count: reviewCount },
            recentActivity,
            canReport: viewerUserId !== targetUserId,
        };
    },
};
