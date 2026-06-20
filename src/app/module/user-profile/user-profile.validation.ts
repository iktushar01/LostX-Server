import { z } from "zod";
import { TrustFlag, UserReportReason, UserReportStatus } from "../../lib/prisma-exports.js";

export const userIdParamSchema = z.object({
    id: z.string().min(1),
});

export const createReviewSchema = z.object({
    claimId: z.string().min(1),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().max(500).trim().optional(),
});

export const listReviewsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const createReportSchema = z.object({
    reportedId: z.string().min(1),
    reason: z.nativeEnum(UserReportReason),
    details: z.string().min(10).max(1000).trim(),
    claimId: z.string().min(1).optional(),
    lostItemId: z.string().min(1).optional(),
    foundItemId: z.string().min(1).optional(),
});

export const adminUpdateReportSchema = z.object({
    status: z.nativeEnum(UserReportStatus),
    adminNote: z.string().max(1000).trim().optional(),
    trustFlag: z.nativeEnum(TrustFlag).optional(),
    suspendUser: z.coerce.boolean().optional(),
});

export const deleteAccountSchema = z.object({
    email: z.string().email().trim(),
    password: z.string().min(1).optional(),
});
