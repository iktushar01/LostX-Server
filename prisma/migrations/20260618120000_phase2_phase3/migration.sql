-- Phase 2/3: roles, statuses, structured location, claim enhancements, audit logs

-- Role: add STAFF for lost-and-found desk
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';

-- Item statuses: expiry support
ALTER TYPE "LostItemStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "LostItemStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "FoundItemStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Structured campus location
ALTER TABLE "lost_items" ADD COLUMN IF NOT EXISTS "building" TEXT;
ALTER TABLE "lost_items" ADD COLUMN IF NOT EXISTS "floor" TEXT;
ALTER TABLE "lost_items" ADD COLUMN IF NOT EXISTS "room" TEXT;

ALTER TABLE "found_items" ADD COLUMN IF NOT EXISTS "building" TEXT;
ALTER TABLE "found_items" ADD COLUMN IF NOT EXISTS "floor" TEXT;
ALTER TABLE "found_items" ADD COLUMN IF NOT EXISTS "room" TEXT;

-- Claim enhancements
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "autoApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "matchScore" INTEGER;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "receivedConfirmedAt" TIMESTAMP(3);
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "handoffCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "claims_handoffCode_key" ON "claims"("handoffCode");
CREATE UNIQUE INDEX IF NOT EXISTS "claims_foundItemId_userId_key" ON "claims"("foundItemId", "userId");

-- Audit logs
CREATE TYPE "AuditAction" AS ENUM (
  'CLAIM_APPROVED',
  'CLAIM_REJECTED',
  'CLAIM_AUTO_APPROVED',
  'CLAIM_RECEIVED_CONFIRMED',
  'ITEM_CREATED',
  'ITEM_DELETED',
  'ITEM_FEATURED',
  'ITEM_RETURNED',
  'ITEM_EXPIRED',
  'ITEM_REGISTERED_BY_STAFF'
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
