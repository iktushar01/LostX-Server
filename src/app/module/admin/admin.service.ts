import { prisma } from "../../lib/prisma";
import { ClaimStatus, LostItemStatus } from "../../lib/prisma-exports";

export const AdminService = {
    getStats: async () => {
        const [
            totalLostItems,
            totalFoundItems,
            totalClaims,
            pendingClaims,
            approvedClaims,
            recoveredItems,
        ] = await Promise.all([
            prisma.lostItem.count(),
            prisma.foundItem.count(),
            prisma.claim.count(),
            prisma.claim.count({ where: { status: ClaimStatus.PENDING } }),
            prisma.claim.count({ where: { status: ClaimStatus.APPROVED } }),
            prisma.lostItem.count({ where: { status: LostItemStatus.RECOVERED } }),
        ]);

        return {
            totalLostItems,
            totalFoundItems,
            totalClaims,
            pendingClaims,
            approvedClaims,
            recoveredItems,
        };
    },
};
