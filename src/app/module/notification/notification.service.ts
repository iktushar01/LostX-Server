import { prisma } from "../../lib/prisma";
import { NotificationType, UserRole } from "../../lib/prisma-exports";
import { sendEmail } from "../../utils/email";
import { envVars } from "../../../config/env";

type CreateNotificationInput = {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    href?: string;
};

const sendClaimEmail = async (
    to: string,
    templateName: "claim-approved" | "claim-rejected",
    templateData: Record<string, string>,
) => {
    try {
        await sendEmail({
            to,
            subject: templateName === "claim-approved" ? "Your claim was approved" : "Your claim was rejected",
            templateName,
            templateData,
        });
    } catch (error) {
        console.error("Failed to send claim notification email:", error);
    }
};

export const NotificationService = {
    create: async ({ userId, type, title, body, href }: CreateNotificationInput) =>
        prisma.notification.create({
            data: { userId, type, title, body, href: href ?? null },
        }),

    listForUser: async (userId: string, limit = 20) =>
        prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
        }),

    markAsRead: async (notificationId: string, userId: string) => {
        const notification = await prisma.notification.findFirst({
            where: { id: notificationId, userId },
        });

        if (!notification) return null;

        return prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
    },

    markAllAsRead: async (userId: string) =>
        prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        }),

    notifyClaimApproved: async (params: {
        userId: string;
        userEmail: string;
        userName: string;
        itemTitle: string;
        claimId: string;
    }) => {
        const href = `${envVars.FRONTEND_URL}/claims`;
        await NotificationService.create({
            userId: params.userId,
            type: NotificationType.CLAIM_APPROVED,
            title: "Claim approved",
            body: `Your claim for "${params.itemTitle}" was approved. Coordinate pickup with the finder.`,
            href,
        });
        await sendClaimEmail(params.userEmail, "claim-approved", {
            name: params.userName,
            itemTitle: params.itemTitle,
            claimsUrl: href,
        });
    },

    notifyClaimRejected: async (params: {
        userId: string;
        userEmail: string;
        userName: string;
        itemTitle: string;
        reason: string;
    }) => {
        const href = `${envVars.FRONTEND_URL}/claims`;
        await NotificationService.create({
            userId: params.userId,
            type: NotificationType.CLAIM_REJECTED,
            title: "Claim rejected",
            body: params.reason,
            href,
        });
        await sendClaimEmail(params.userEmail, "claim-rejected", {
            name: params.userName,
            itemTitle: params.itemTitle,
            reason: params.reason,
            claimsUrl: href,
        });
    },

    notifyItemReturned: async (params: {
        userId: string;
        userEmail: string;
        userName: string;
        itemTitle: string;
    }) => {
        const href = `${envVars.FRONTEND_URL}/claims`;
        await NotificationService.create({
            userId: params.userId,
            type: NotificationType.ITEM_RETURNED,
            title: "Item returned",
            body: `"${params.itemTitle}" has been marked as returned. Thank you for using LostX!`,
            href,
        });
        await sendEmail({
            to: params.userEmail,
            subject: "Your item has been returned",
            templateName: "claim-approved",
            templateData: {
                name: params.userName,
                itemTitle: params.itemTitle,
                claimsUrl: href,
                headline: "Item successfully returned",
                message: `Great news — "${params.itemTitle}" has been marked as returned to you.`,
            },
        });
    },

    notifyClaimPending: async (params: {
        claimId: string;
        claimantName: string;
        itemTitle: string;
    }) => {
        const admins = await prisma.user.findMany({
            where: { role: UserRole.ADMIN },
            select: { id: true, email: true, name: true },
        });

        const href = `${envVars.FRONTEND_URL}/admin/claims/${params.claimId}`;

        await Promise.all(
            admins.map((admin) =>
                NotificationService.create({
                    userId: admin.id,
                    type: NotificationType.CLAIM_PENDING,
                    title: "New claim pending review",
                    body: `${params.claimantName} submitted a claim for "${params.itemTitle}". Verification passed — review required.`,
                    href,
                }),
            ),
        );
    },

    notifyFinderNewClaim: async (params: {
        finderId: string;
        finderEmail: string;
        finderName: string;
        itemTitle: string;
        claimantName: string;
        claimId: string;
    }) => {
        const href = `${envVars.FRONTEND_URL}/claims/${params.claimId}`;
        await NotificationService.create({
            userId: params.finderId,
            type: NotificationType.CLAIM_PENDING,
            title: "Someone claimed your found item",
            body: `${params.claimantName} submitted a claim for "${params.itemTitle}". An admin will review it.`,
            href,
        });

        try {
            await sendEmail({
                to: params.finderEmail,
                subject: "New claim on your found item",
                templateName: "claim-approved",
                templateData: {
                    name: params.finderName,
                    itemTitle: params.itemTitle,
                    claimsUrl: href,
                    headline: "New claim submitted",
                    message: `${params.claimantName} submitted a claim for your found item "${params.itemTitle}". An admin will review it shortly.`,
                },
            });
        } catch (error) {
            console.error("Failed to send finder claim notification email:", error);
        }
    },

    notifyMatchFound: async (params: {
        userId: string;
        userEmail: string;
        userName: string;
        lostItemTitle: string;
        matchedItemTitle: string;
        matchScore: number;
        foundItemId: string;
    }) => {
        const href = `${envVars.FRONTEND_URL}/dashboard/found/${params.foundItemId}`;
        await NotificationService.create({
            userId: params.userId,
            type: NotificationType.MATCH_FOUND,
            title: "Possible match found",
            body: `We found a possible match (${params.matchScore}%) for your lost item "${params.lostItemTitle}": "${params.matchedItemTitle}".`,
            href,
        });

        try {
            await sendEmail({
                to: params.userEmail,
                subject: "Possible match for your lost item",
                templateName: "claim-approved",
                templateData: {
                    name: params.userName,
                    itemTitle: params.lostItemTitle,
                    claimsUrl: href,
                    headline: "Possible match found",
                    message: `Good news — we found a possible match (${params.matchScore}%) for "${params.lostItemTitle}": "${params.matchedItemTitle}". View it and submit a claim if it looks like yours.`,
                },
            });
        } catch (error) {
            console.error("Failed to send match-found notification email:", error);
        }
    },

    notifyPossibleReturn: async (params: {
        userId: string;
        userEmail: string;
        userName: string;
        lostItemTitle: string;
        foundItemTitle: string;
        foundItemId: string;
    }) => {
        const href = `${envVars.FRONTEND_URL}/dashboard/found/${params.foundItemId}`;
        await NotificationService.create({
            userId: params.userId,
            type: NotificationType.POSSIBLE_RETURN,
            title: "Someone may have found your item",
            body: `Someone reported they may have found your lost item "${params.lostItemTitle}". Review the listing and submit a claim if it looks like yours.`,
            href,
        });

        try {
            await sendEmail({
                to: params.userEmail,
                subject: `Someone may have found your item: ${params.lostItemTitle}`,
                templateName: "claim-approved",
                templateData: {
                    name: params.userName,
                    itemTitle: params.lostItemTitle,
                    claimsUrl: href,
                    headline: "Someone may have found your item",
                    message: `Someone reported they may have found "${params.lostItemTitle}" as "${params.foundItemTitle}". If this is yours, open the listing and submit a claim for admin review.`,
                },
            });
        } catch (error) {
            console.error("Failed to send possible-return notification email:", error);
        }
    },
};
