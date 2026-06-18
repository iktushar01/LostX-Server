import { z } from "zod";
import { ItemCategory } from "../../lib/prisma-exports";

export const createLostItemZodSchema = z.object({
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

export const updateLostItemZodSchema = z
    .object({
        title: z.string().min(2).max(120).trim().optional(),
        description: z.string().min(5).max(2000).trim().optional(),
        category: z.nativeEnum(ItemCategory).optional(),
        location: z.string().min(2).max(200).trim().optional(),
        dateLost: z.coerce.date().optional(),
        verificationQuestion: z.string().min(5).max(500).trim().optional(),
        verificationAnswer: z.string().min(2).max(500).trim().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

export const listLostItemsQuerySchema = z.object({
    searchTerm: z.string().optional(),
    category: z.nativeEnum(ItemCategory).optional(),
    status: z.string().optional(),
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const lostItemIdParamSchema = z.object({
    id: z.string().min(1),
});
