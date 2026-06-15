import { z } from "zod";
import { ItemCategory } from "../../lib/prisma-exports";

export const createLostItemZodSchema = z.object({
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(2000).trim(),
    category: z.nativeEnum(ItemCategory),
    imageUrl: z.string().url().optional().nullable(),
    location: z.string().min(2).max(200).trim(),
    dateLost: z.coerce.date(),
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
    id: z.string().uuid(),
});
