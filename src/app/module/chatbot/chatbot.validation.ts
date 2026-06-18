import { z } from "zod";

export const chatMessageZodSchema = z.object({
    message: z.string().trim().min(3).max(1000),
});
