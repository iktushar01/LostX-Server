import { prisma } from "../../lib/prisma.js";
import { AuditAction, FoundItemStatus, LostItemStatus, UserRole } from "../../lib/prisma-exports.js";
import { envVars } from "../../../config/env.js";
import { AuditService } from "../audit/audit.service.js";

export const ExpiryService = {
    archiveStaleItems: async () => {
        const cutoff = new Date(
            Date.now() - envVars.ITEM_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        );

        const [expiredLost, expiredFound] = await Promise.all([
            prisma.lostItem.updateMany({
                where: {
                    status: { in: [LostItemStatus.OPEN, LostItemStatus.MATCHED] },
                    createdAt: { lt: cutoff },
                },
                data: { status: LostItemStatus.EXPIRED },
            }),
            prisma.foundItem.updateMany({
                where: {
                    status: FoundItemStatus.AVAILABLE,
                    createdAt: { lt: cutoff },
                },
                data: { status: FoundItemStatus.EXPIRED },
            }),
        ]);

        if (expiredLost.count > 0 || expiredFound.count > 0) {
            const systemActor = await prisma.user.findFirst({
                where: { role: UserRole.ADMIN },
                select: { id: true },
            });

            if (systemActor) {
                await AuditService.log({
                    actorId: systemActor.id,
                    action: AuditAction.ITEM_EXPIRED,
                    entityType: "system",
                    entityId: "expiry-job",
                    metadata: {
                        expiredLost: expiredLost.count,
                        expiredFound: expiredFound.count,
                        cutoff: cutoff.toISOString(),
                    },
                });
            }
        }

        return { expiredLost: expiredLost.count, expiredFound: expiredFound.count };
    },
};
