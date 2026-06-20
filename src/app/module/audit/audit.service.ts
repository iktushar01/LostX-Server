import { prisma } from "../../lib/prisma.js";
import type { AuditAction } from "../../lib/prisma-exports.js";

type AuditInput = {
    actorId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
};

export const AuditService = {
    log: async ({ actorId, action, entityType, entityId, metadata }: AuditInput) => {
        try {
            await prisma.auditLog.create({
                data: {
                    actorId,
                    action,
                    entityType,
                    entityId,
                    ...(metadata
                        ? { metadata: JSON.parse(JSON.stringify(metadata)) }
                        : {}),
                },
            });
        } catch (error) {
            console.error("[AuditService] Failed to write audit log:", error);
        }
    },

    list: async (limit = 50) =>
        prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                actor: { select: { id: true, name: true, email: true, role: true } },
            },
        }),
};
