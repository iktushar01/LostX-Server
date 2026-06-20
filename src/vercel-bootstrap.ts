import { seedSuperAdmin } from "./app/utils/seed.js";

let bootstrapped = false;

export const ensureVercelBootstrap = async () => {
    if (process.env.VERCEL !== "1" || bootstrapped) {
        return;
    }

    bootstrapped = true;

    await seedSuperAdmin().catch((error) => {
        console.error("Vercel bootstrap seed skipped:", error);
    });
};
