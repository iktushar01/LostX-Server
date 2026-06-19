import { prisma } from "../../lib/prisma";
import {
    ClaimStatus,
    FoundItemStatus,
    TrustFlag,
    UserStatus,
} from "../../lib/prisma-exports";

export type TrustTier = "NEW" | "VERIFIED" | "TRUSTED" | "FLAGGED";

export type TrustResult = {
    score: number;
    tier: TrustTier;
    signals: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const UserTrustService = {
    computeTrust: async (userId: string, options?: { includeAdminSignals?: boolean }): Promise<TrustResult> => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                emailVerified: true,
                createdAt: true,
                trustFlag: true,
                status: true,
            },
        });

        if (!user) {
            return { score: 0, tier: "NEW", signals: [] };
        }

        const signals: string[] = [];
        let score = user.emailVerified ? 20 : 10;
        if (user.emailVerified) {
            signals.push("Email verified");
        }

        const [approvedClaims, totalClaims, completedReturns] = await Promise.all([
            prisma.claim.count({ where: { userId, status: ClaimStatus.APPROVED } }),
            prisma.claim.count({ where: { userId } }),
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

        const approvedBonus = Math.min(approvedClaims * 10, 30);
        if (approvedBonus > 0) {
            score += approvedBonus;
            signals.push(`${approvedClaims} approved claim${approvedClaims === 1 ? "" : "s"}`);
        }

        if (completedReturns > 0) {
            score += completedReturns * 15;
            signals.push(`${completedReturns} completed handoff${completedReturns === 1 ? "" : "s"}`);
        }

        const accountAgeDays =
            (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (accountAgeDays > 30) {
            score += 5;
            signals.push("Account older than 30 days");
        }

        if (totalClaims >= 2) {
            const rejected = await prisma.claim.count({
                where: { userId, status: ClaimStatus.REJECTED },
            });
            if (rejected / totalClaims > 0.5) {
                score -= 20;
                signals.push("High rejected-claim ratio");
            }
        }

        const isFlagged =
            user.status === UserStatus.SUSPENDED ||
            user.trustFlag === TrustFlag.WARNING ||
            user.trustFlag === TrustFlag.UNDER_REVIEW;

        if (isFlagged) {
            score -= 50;
            if (options?.includeAdminSignals) {
                if (user.status === UserStatus.SUSPENDED) {
                    signals.push("Account suspended by admin");
                }
                if (user.trustFlag === TrustFlag.WARNING) {
                    signals.push("Admin trust warning");
                }
                if (user.trustFlag === TrustFlag.UNDER_REVIEW) {
                    signals.push("Under admin review");
                }
            } else {
                signals.push("Trust limited pending review");
            }
        }

        score = clamp(score);

        let tier: TrustTier = "NEW";
        if (isFlagged) {
            tier = "FLAGGED";
        } else if (score >= 70) {
            tier = "TRUSTED";
        } else if (score >= 40 && user.emailVerified) {
            tier = "VERIFIED";
        }

        return { score, tier, signals };
    },
};
