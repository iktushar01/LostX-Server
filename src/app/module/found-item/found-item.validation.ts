import { z } from "zod";
import { ItemCategory } from "../../lib/prisma-exports";

export const createFoundItemZodSchema = z.object({
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(2000).trim(),
    category: z.nativeEnum(ItemCategory),
    location: z.string().min(2).max(200).trim(),
    dateFound: z.coerce.date(),
});

export const updateFoundItemZodSchema = z
    .object({
        title: z.string().min(2).max(120).trim().optional(),
        description: z.string().min(5).max(2000).trim().optional(),
        category: z.nativeEnum(ItemCategory).optional(),
        location: z.string().min(2).max(200).trim().optional(),
        dateFound: z.coerce.date().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

export const foundItemIdParamSchema = z.object({
    id: z.string().min(1),
});
