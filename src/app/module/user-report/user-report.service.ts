import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma";
import {
    TrustFlag,
    UserReportReason,
    UserReportStatus,
    UserStatus,
} from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";

type CreateReportPayload = {
    reportedId: string;
    reason: UserReportReason;
    details: string;
    claimId?: string;
    lostItemId?: string;
    foundItemId?: string;
};

type AdminUpdateReportPayload = {
    status: UserReportStatus;
    adminNote?: string;
    trustFlag?: TrustFlag;
    suspendUser?: boolean;
};

export const UserReportService = {
    create: async (reporterId: string, payload: CreateReportPayload) => {
        if (reporterId === payload.reportedId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "You cannot report yourself");
        }

        const reported = await prisma.user.findUnique({
            where: { id: payload.reportedId },
            select: { id: true, isDeleted: true, status: true },
        });

        if (!reported || reported.isDeleted || reported.status === UserStatus.DELETED) {
            throw new AppError(StatusCodes.NOT_FOUND, "User not found");
        }

        return prisma.userReport.create({
            data: {
                reporterId,
                reportedId: payload.reportedId,
                reason: payload.reason,
                details: payload.details.trim(),
                claimId: payload.claimId ?? null,
                lostItemId: payload.lostItemId ?? null,
                foundItemId: payload.foundItemId ?? null,
            },
        });
    },

    listForAdmin: async (status?: UserReportStatus) => {
        return prisma.userReport.findMany({
            ...(status ? { where: { status } } : {}),
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
                reporter: { select: { id: true, name: true, email: true } },
                reported: { select: { id: true, name: true, email: true, trustFlag: true, status: true } },
            },
        });
    },

    updateByAdmin: async (reportId: string, adminId: string, payload: AdminUpdateReportPayload) => {
        const report = await prisma.userReport.findUnique({
            where: { id: reportId },
            include: { reported: { select: { id: true } } },
        });

        if (!report) {
            throw new AppError(StatusCodes.NOT_FOUND, "Report not found");
        }

        await prisma.$transaction(async (tx) => {
            await tx.userReport.update({
                where: { id: reportId },
                data: {
                    status: payload.status,
                    adminNote: payload.adminNote?.trim() || report.adminNote,
                },
            });

            if (payload.trustFlag) {
                await tx.user.update({
                    where: { id: report.reportedId },
                    data: { trustFlag: payload.trustFlag },
                });
            }

            if (payload.suspendUser) {
                await tx.user.update({
                    where: { id: report.reportedId },
                    data: { status: UserStatus.SUSPENDED },
                });
            }
        });

        return prisma.userReport.findUnique({
            where: { id: reportId },
            include: {
                reporter: { select: { id: true, name: true, email: true } },
                reported: { select: { id: true, name: true, email: true, trustFlag: true, status: true } },
            },
        });
    },
};
