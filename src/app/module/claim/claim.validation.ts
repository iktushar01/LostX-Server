import { z } from "zod";
import { ClaimStatus, ItemCategory } from "../../lib/prisma-exports";

export const createClaimZodSchema = z.object({
    foundItemId: z.string().min(1),
    lostItemId: z.string().min(1),
    answer: z.string().min(2).max(2000).trim(),
});

export const quickClaimZodSchema = z.object({
    foundItemId: z.string().min(1),
    answer: z.string().min(2).max(2000).trim(),
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(2000).trim(),
    category: z.nativeEnum(ItemCategory),
    location: z.string().min(2).max(200).trim(),
    building: z.string().max(120).trim().optional(),
    floor: z.string().max(20).trim().optional(),
    room: z.string().max(20).trim().optional(),
    dateLost: z.coerce.date(),
    verificationQuestion: z.string().min(5).max(500).trim(),
    verificationAnswer: z.string().min(2).max(500).trim(),
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
