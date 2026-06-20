import * as prismaModule from "../../generated/prisma/index.js";

export const PrismaClient = prismaModule.PrismaClient;
export const Prisma = prismaModule.Prisma;

export const UserStatus = prismaModule.UserStatus;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

const PrismaRole = prismaModule.Role;

/** @deprecated Use Role — kept for backward compatibility */
export const UserRole = PrismaRole;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Role = {
  ...PrismaRole,
  CLIENT: PrismaRole.USER,
  SUPER_ADMIN: PrismaRole.ADMIN,
} as const;
export type Role = (typeof PrismaRole)[keyof typeof PrismaRole] | "CLIENT" | "SUPER_ADMIN";

export const ItemCategory = prismaModule.ItemCategory;
export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

export const LostItemStatus = prismaModule.LostItemStatus;
export type LostItemStatus = (typeof LostItemStatus)[keyof typeof LostItemStatus];

export const FoundItemStatus = prismaModule.FoundItemStatus;
export type FoundItemStatus = (typeof FoundItemStatus)[keyof typeof FoundItemStatus];

export const ClaimStatus = prismaModule.ClaimStatus;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const NotificationType = prismaModule.NotificationType;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const AuditAction = prismaModule.AuditAction;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const TrustFlag = prismaModule.TrustFlag;
export type TrustFlag = (typeof TrustFlag)[keyof typeof TrustFlag];

export const UserReportReason = prismaModule.UserReportReason;
export type UserReportReason = (typeof UserReportReason)[keyof typeof UserReportReason];

export const UserReportStatus = prismaModule.UserReportStatus;
export type UserReportStatus = (typeof UserReportStatus)[keyof typeof UserReportStatus];

/** Profile field only — not stored on the user model */
export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
