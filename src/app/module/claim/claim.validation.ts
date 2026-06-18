import { z } from "zod";
import { ClaimStatus } from "../../lib/prisma-exports";

export const createClaimZodSchema = z.object({
    foundItemId: z.string().min(1),
    lostItemId: z.string().min(1),
    answer: z.string().min(2).max(2000).trim(),
});

export const updateClaimStatusZodSchema = z.object({
    status: z.enum([ClaimStatus.APPROVED, ClaimStatus.REJECTED]),
});

export const claimIdParamSchema = z.object({
    id: z.string().min(1),
});

export const listClaimsQuerySchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum([ClaimStatus.PENDING, ClaimStatus.APPROVED, ClaimStatus.REJECTED]).optional(),
});
