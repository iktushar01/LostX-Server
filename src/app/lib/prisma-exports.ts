import prismaPkg from "../../generated/prisma/index.js";

const prismaModule = prismaPkg as typeof import("../../generated/prisma/index.js");

export const PrismaClient = prismaModule.PrismaClient;
export const Prisma = prismaModule.Prisma;

export const UserStatus = prismaModule.UserStatus;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const Gender = prismaModule.Gender;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const BloodGroup = prismaModule.BloodGroup;
export type BloodGroup = (typeof BloodGroup)[keyof typeof BloodGroup];

export const RequestStatus = prismaModule.RequestStatus;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const RequestType = prismaModule.RequestType;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const ResponseStatus = prismaModule.ResponseStatus;
export type ResponseStatus = (typeof ResponseStatus)[keyof typeof ResponseStatus];

export const Urgency = prismaModule.Urgency;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

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

/** Legacy stubs — not in current Prisma schema */
export const ItemCategory = {
  ID_CARD: "ID_CARD",
  WALLET: "WALLET",
  PHONE: "PHONE",
  LAPTOP: "LAPTOP",
  KEYS: "KEYS",
  BAG: "BAG",
  BOOK: "BOOK",
  OTHER: "OTHER",
} as const;
export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

export const LostItemStatus = {
  OPEN: "OPEN",
  MATCHED: "MATCHED",
  RECOVERED: "RECOVERED",
} as const;
export type LostItemStatus = (typeof LostItemStatus)[keyof typeof LostItemStatus];

export const FoundItemStatus = {
  AVAILABLE: "AVAILABLE",
  CLAIMED: "CLAIMED",
  RETURNED: "RETURNED",
} as const;
export type FoundItemStatus = (typeof FoundItemStatus)[keyof typeof FoundItemStatus];

export const ClaimStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];
