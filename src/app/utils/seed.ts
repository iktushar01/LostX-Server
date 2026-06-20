import { UserRole } from "../lib/prisma-exports.js";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { envVars } from "../../config/env.js";

export const seedSuperAdmin = async () => {
    try {
        if (!envVars.SUPER_ADMIN_EMAIL || !envVars.SUPER_ADMIN_PASSWORD) {
            console.warn("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set. Skipping seeding.");
            return;
        }

        const trimmedEmail = envVars.SUPER_ADMIN_EMAIL.trim();

        const isAdminExist = await prisma.user.findFirst({
            where: {
                role: UserRole.ADMIN,
                email: trimmedEmail,
            },
        });

        if (isAdminExist) {
            console.log("Admin already exists. Skipping seeding.");
            return;
        }

        console.log(`Seeding admin with email: ${trimmedEmail}`);

        const adminUser = await auth.api.signUpEmail({
            body: {
                email: trimmedEmail,
                password: envVars.SUPER_ADMIN_PASSWORD,
                name: "Super Admin",
                role: UserRole.ADMIN,
                needPasswordChange: false,
                rememberMe: false,
            },
        });

        if (!adminUser?.user) {
            throw new Error("Failed to create admin user through auth API");
        }

        await prisma.user.update({
            where: { id: adminUser.user.id },
            data: {
                emailVerified: true,
                role: UserRole.ADMIN,
            },
        });

        console.log("Admin created successfully.");
    } catch (error) {
        console.error("Error seeding admin:", error);

        try {
            if (envVars.SUPER_ADMIN_EMAIL) {
                await prisma.user.deleteMany({
                    where: {
                        email: envVars.SUPER_ADMIN_EMAIL.trim(),
                    },
                });
            }
        } catch (cleanupError) {
            console.error("Failed to clean up admin seed state:", cleanupError);
        }
    }
};
