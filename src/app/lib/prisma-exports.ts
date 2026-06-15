import prismaPkg from "../../generated/prisma/index.js";

const prismaModule = prismaPkg as typeof import("../../generated/prisma/index.js");

export const PrismaClient = prismaModule.PrismaClient;
export const Prisma = prismaModule.Prisma;

export const UserRole = prismaModule.UserRole;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = prismaModule.UserStatus;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ItemCategory = prismaModule.ItemCategory;
export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

export const LostItemStatus = prismaModule.LostItemStatus;
export type LostItemStatus = (typeof LostItemStatus)[keyof typeof LostItemStatus];

export const FoundItemStatus = prismaModule.FoundItemStatus;
export type FoundItemStatus = (typeof FoundItemStatus)[keyof typeof FoundItemStatus];

export const ClaimStatus = prismaModule.ClaimStatus;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

/** Legacy stub — not in LostX schema */
export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const Role = {
  ...UserRole,
  CLIENT: UserRole.USER,
  SUPER_ADMIN: UserRole.ADMIN,
} as const;
export type Role = UserRole | "CLIENT" | "SUPER_ADMIN";
