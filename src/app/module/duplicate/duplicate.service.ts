import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { envVars } from "../../../config/env.js";
import { ItemCategory } from "../../lib/prisma-exports.js";

type DuplicateCheckInput = {
    userId: string;
    title: string;
    category: ItemCategory;
    location: string;
    eventDate: Date;
};

const normalize = (value: string): string => value.trim().toLowerCase();

export const DuplicateService = {
    assertNotDuplicateLost: async (input: DuplicateCheckInput): Promise<void> => {
        const windowStart = new Date(
            Date.now() - envVars.DUPLICATE_REPORT_WINDOW_HOURS * 60 * 60 * 1000,
        );

        const existing = await prisma.lostItem.findFirst({
            where: {
                userId: input.userId,
                category: input.category,
                createdAt: { gte: windowStart },
                title: { equals: input.title, mode: "insensitive" },
                location: { equals: input.location, mode: "insensitive" },
                dateLost: input.eventDate,
            },
            select: { id: true },
        });

        if (existing) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "You already reported a very similar lost item in the last 24 hours.",
            );
        }
    },

    assertNotDuplicateFound: async (input: DuplicateCheckInput): Promise<void> => {
        const windowStart = new Date(
            Date.now() - envVars.DUPLICATE_REPORT_WINDOW_HOURS * 60 * 60 * 1000,
        );

        const existing = await prisma.foundItem.findFirst({
            where: {
                userId: input.userId,
                category: input.category,
                createdAt: { gte: windowStart },
                title: { equals: input.title, mode: "insensitive" },
                location: { equals: input.location, mode: "insensitive" },
                dateFound: input.eventDate,
            },
            select: { id: true },
        });

        if (existing) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "You already posted a very similar found item in the last 24 hours.",
            );
        }
    },
};
