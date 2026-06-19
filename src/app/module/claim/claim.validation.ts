import { z } from "zod";
import { ClaimStatus, ItemCategory } from "../../lib/prisma-exports";

const aiAnswerSchema = z.object({
    id: z.string().min(1),
    answer: z.string().min(1).max(2000).trim(),
});

const aiQuestionSchema = z.object({
    id: z.string().min(1),
    question: z.string().min(5).max(500).trim(),
});

export const verificationQuestionsZodSchema = z.object({
    foundItemId: z.string().min(1),
    lostItemId: z.string().min(1),
});

export const verificationQuestionsPreviewZodSchema = z.object({
    foundItemId: z.string().min(1),
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(500).trim(),
    privateDescription: z.string().min(10).max(5000).trim(),
});

export const createClaimZodSchema = z
    .object({
        foundItemId: z.string().min(1),
        lostItemId: z.string().min(1),
        answer: z.string().min(2).max(2000).trim().optional(),
        aiQuestions: z.array(aiQuestionSchema).min(1).max(5).optional(),
        aiAnswers: z.array(aiAnswerSchema).min(1).max(5).optional(),
    })
    .refine(
        (data) =>
            (data.aiQuestions?.length && data.aiAnswers?.length) ||
            data.answer?.trim(),
        { message: "Provide AI answers or a legacy verification answer" },
    );

export const quickClaimZodSchema = z.object({
    foundItemId: z.string().min(1),
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(500).trim(),
    privateDescription: z.string().min(10).max(5000).trim(),
    category: z.nativeEnum(ItemCategory),
    location: z.string().min(2).max(200).trim(),
    building: z.string().max(120).trim().optional(),
    floor: z.string().max(20).trim().optional(),
    room: z.string().max(20).trim().optional(),
    dateLost: z.coerce.date(),
    showImagePublic: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
    showDescriptionPublic: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
    showLocationPublic: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
    aiQuestions: z.array(aiQuestionSchema).min(1).max(5),
    aiAnswers: z.array(aiAnswerSchema).min(1).max(5),
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
