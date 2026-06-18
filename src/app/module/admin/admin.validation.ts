import { z } from "zod";

export const adminItemTypeParamSchema = z.object({
    type: z.enum(["lost", "found"]),
    id: z.string().min(1),
});

export const adminFeatureItemZodSchema = z.object({
    isFeatured: z.boolean(),
});

