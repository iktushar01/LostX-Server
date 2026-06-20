import { envVars } from "./env.js";

const LOCAL_ORIGINS = ["http://localhost:3000", "http://localhost:5000"];

export const getAllowedOrigins = (): string[] => {
    const origins = new Set<string>([
        envVars.FRONTEND_URL,
        envVars.BETTER_AUTH_URL,
        ...LOCAL_ORIGINS,
    ]);

    if (process.env.VERCEL_URL) {
        origins.add(`https://${process.env.VERCEL_URL}`);
    }

    if (process.env.VERCEL_BRANCH_URL) {
        origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);
    }

    if (process.env.ALLOWED_ORIGINS) {
        for (const origin of process.env.ALLOWED_ORIGINS.split(",")) {
            const trimmed = origin.trim();
            if (trimmed) {
                origins.add(trimmed);
            }
        }
    }

    return [...origins];
};
