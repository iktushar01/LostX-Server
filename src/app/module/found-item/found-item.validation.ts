import { z } from "zod";
import { ItemCategory } from "../../lib/prisma-exports.js";

const visibilitySchema = z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional();

export const createFoundItemZodSchema = z.object({
    title: z.string().min(2).max(120).trim(),
    description: z.string().min(5).max(500).trim(),
    privateDescription: z.string().min(10).max(5000).trim(),
    category: z.nativeEnum(ItemCategory),
    location: z.string().min(2).max(200).trim(),
    building: z.string().max(120).trim().optional(),
    floor: z.string().max(20).trim().optional(),
    room: z.string().max(20).trim().optional(),
    dateFound: z.coerce.date(),
    showImagePublic: visibilitySchema,
    showDescriptionPublic: visibilitySchema,
    showLocationPublic: visibilitySchema,
    onBehalfOfUserId: z.string().min(1).optional(),
    linkedLostItemId: z.string().min(1).optional(),
});

export const finderTipZodSchema = z.object({
    note: z.string().max(500).trim().optional(),
    location: z.string().min(2).max(200).trim(),
    building: z.string().max(120).trim().optional(),
    floor: z.string().max(20).trim().optional(),
    room: z.string().max(20).trim().optional(),
    dateFound: z.coerce.date(),
});

export const updateFoundItemZodSchema = z
    .object({
        title: z.string().min(2).max(120).trim().optional(),
        description: z.string().min(5).max(500).trim().optional(),
        privateDescription: z.string().min(10).max(5000).trim().optional(),
        category: z.nativeEnum(ItemCategory).optional(),
        location: z.string().min(2).max(200).trim().optional(),
        building: z.string().max(120).trim().optional(),
        floor: z.string().max(20).trim().optional(),
        room: z.string().max(20).trim().optional(),
        dateFound: z.coerce.date().optional(),
        showImagePublic: visibilitySchema,
        showDescriptionPublic: visibilitySchema,
        showLocationPublic: visibilitySchema,
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

export const foundItemIdParamSchema = z.object({
    id: z.string().min(1),
});

export const lostItemIdParamSchema = z.object({
    lostItemId: z.string().min(1),
});
