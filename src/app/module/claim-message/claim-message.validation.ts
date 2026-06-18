import { z } from "zod";

export const claimMessageParamSchema = z.object({
    id: z.string().min(1),
});

export const createClaimMessageZodSchema = z.object({
    content: z.string().trim().min(1).max(2000),
});

