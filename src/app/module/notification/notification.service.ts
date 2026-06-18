import { prisma } from "../../lib/prisma";
import { NotificationType } from "../../lib/prisma-exports";
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
};
