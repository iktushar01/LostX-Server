import type { Prisma as PrismaNamespace } from "../../../generated/prisma/index";
import { prisma } from "../../lib/prisma";
import {
    AuditAction,
    ClaimStatus,
    FoundItemStatus,
    LostItemStatus,
} from "../../lib/prisma-exports";
import { AuditService } from "../audit/audit.service";

type ItemType = "lost" | "found";

type ListItemFilters = {
    type: ItemType;
    search?: string;
    status?: string;
    featured?: boolean;
};

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

    getAnalytics: async () => {
        const [
            totalLost,
            recoveredLost,
            returnedFound,
            approvedClaims,
            autoApprovedClaims,
            lostByCategory,
            foundByCategory,
            returnedClaims,
        ] = await Promise.all([
            prisma.lostItem.count(),
            prisma.lostItem.count({ where: { status: LostItemStatus.RECOVERED } }),
            prisma.foundItem.count({ where: { status: FoundItemStatus.RETURNED } }),
            prisma.claim.count({ where: { status: ClaimStatus.APPROVED } }),
            prisma.claim.count({ where: { autoApproved: true, status: ClaimStatus.APPROVED } }),
            prisma.lostItem.groupBy({
                by: ["category"],
                _count: { category: true },
            }),
            prisma.foundItem.groupBy({
                by: ["category"],
                _count: { category: true },
            }),
            prisma.claim.findMany({
                where: {
                    status: ClaimStatus.APPROVED,
                    receivedConfirmedAt: { not: null },
                },
                select: {
                    createdAt: true,
                    receivedConfirmedAt: true,
                },
            }),
        ]);

        const recoveryRate =
            totalLost > 0 ? Math.round((recoveredLost / totalLost) * 100) : 0;

        const avgDaysToReturn =
            returnedClaims.length > 0
                ? Math.round(
                      returnedClaims.reduce((sum, claim) => {
                          const days =
                              (claim.receivedConfirmedAt!.getTime() - claim.createdAt.getTime()) /
                              (1000 * 60 * 60 * 24);
                          return sum + days;
                      }, 0) / returnedClaims.length,
                  )
                : 0;

        return {
            recoveryRate,
            avgDaysToReturn,
            returnedItems: returnedFound,
            approvedClaims,
            autoApprovedClaims,
            autoApproveRate:
                approvedClaims > 0
                    ? Math.round((autoApprovedClaims / approvedClaims) * 100)
                    : 0,
            topLostCategories: lostByCategory
                .map((row) => ({ category: row.category, count: row._count.category }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
            topFoundCategories: foundByCategory
                .map((row) => ({ category: row.category, count: row._count.category }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
        };
    },

    getAuditLogs: async (limit = 50) => AuditService.list(limit),

    listItems: async ({ type, search, status, featured }: ListItemFilters) => {
        if (type === "lost") {
            const where: PrismaNamespace.LostItemWhereInput = {};
            if (search) {
                where.OR = [
                    { title: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                    { location: { contains: search, mode: "insensitive" } },
                ];
            }
            if (status && Object.values(LostItemStatus).includes(status as LostItemStatus)) {
                where.status = status as LostItemStatus;
            }
            if (featured !== undefined) {
                where.isFeatured = featured;
            }

            const items = await prisma.lostItem.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    _count: { select: { claims: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 200,
            });

            return items.map((item) => ({
                ...item,
                itemType: "lost" as const,
                claimCount: item._count.claims,
            }));
        }

        const where: PrismaNamespace.FoundItemWhereInput = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && Object.values(FoundItemStatus).includes(status as FoundItemStatus)) {
            where.status = status as FoundItemStatus;
        }
        if (featured !== undefined) {
            where.isFeatured = featured;
        }

        const items = await prisma.foundItem.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                _count: { select: { claims: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        return items.map((item) => ({
            ...item,
            itemType: "found" as const,
            claimCount: item._count.claims,
        }));
    },

    setItemFeatured: async (type: ItemType, id: string, isFeatured: boolean, actorId: string) => {
        const result =
            type === "lost"
                ? await prisma.lostItem.update({
                      where: { id },
                      data: { isFeatured },
                  })
                : await prisma.foundItem.update({
                      where: { id },
                      data: { isFeatured },
                  });

        await AuditService.log({
            actorId,
            action: AuditAction.ITEM_FEATURED,
            entityType: type === "lost" ? "lost_item" : "found_item",
            entityId: id,
            metadata: { isFeatured },
        });

        return result;
    },

    deleteItem: async (type: ItemType, id: string, actorId: string) => {
        if (type === "lost") {
            await prisma.lostItem.delete({ where: { id } });
        } else {
            await prisma.foundItem.delete({ where: { id } });
        }

        await AuditService.log({
            actorId,
            action: AuditAction.ITEM_DELETED,
            entityType: type === "lost" ? "lost_item" : "found_item",
            entityId: id,
        });

        return { id, type };
    },
};
