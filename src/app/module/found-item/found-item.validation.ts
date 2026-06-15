import { z } from "zod";
import { ItemCategory } from "../../lib/prisma-exports";

export const createFoundItemZodSchema = z.object({
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(2000).trim(),
    category: z.nativeEnum(ItemCategory),
    imageUrl: z.string().url().optional().nullable(),
    location: z.string().min(2).max(200).trim(),
    dateFound: z.coerce.date(),
});

export const foundItemIdParamSchema = z.object({
    id: z.string().uuid(),
});
