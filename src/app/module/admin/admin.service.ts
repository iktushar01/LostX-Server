import type { Prisma as PrismaNamespace } from "../../../generated/prisma/index";
import { prisma } from "../../lib/prisma";
import {
    ClaimStatus,
    FoundItemStatus,
    LostItemStatus,
} from "../../lib/prisma-exports";

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

    setItemFeatured: async (type: ItemType, id: string, isFeatured: boolean) => {
        if (type === "lost") {
            return prisma.lostItem.update({
                where: { id },
                data: { isFeatured },
            });
        }

        return prisma.foundItem.update({
            where: { id },
            data: { isFeatured },
        });
    },

    deleteItem: async (type: ItemType, id: string) => {
        if (type === "lost") {
            await prisma.lostItem.delete({ where: { id } });
            return { id, type };
        }

        await prisma.foundItem.delete({ where: { id } });
        return { id, type };
    },
};
