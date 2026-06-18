import { UserRole } from "../lib/prisma-exports";

/** Roles that can perform lost-and-found desk operations (claims, item moderation). */
export const isStaffOrAdmin = (role: string): boolean =>
    role === UserRole.ADMIN || role === UserRole.STAFF || role === "SUPER_ADMIN";

export const isAdminOnly = (role: string): boolean =>
    role === UserRole.ADMIN || role === "SUPER_ADMIN";
