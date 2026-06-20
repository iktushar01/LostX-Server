import { prisma } from "../../lib/prisma.js";
import { ClaimStatus } from "../../lib/prisma-exports.js";

export const DashboardService = {
    getUserStats: async (userId: string) => {
        const [lostReports, foundReports, approvedClaims] = await Promise.all([
            prisma.lostItem.count({ where: { userId } }),
            prisma.foundItem.count({ where: { userId } }),
            prisma.claim.count({
                where: { userId, status: ClaimStatus.APPROVED },
            }),
        ]);

        return { lostReports, foundReports, approvedClaims };
    },
};
