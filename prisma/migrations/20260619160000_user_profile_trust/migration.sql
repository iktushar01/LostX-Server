-- CreateEnum
CREATE TYPE "TrustFlag" AS ENUM ('NONE', 'WARNING', 'UNDER_REVIEW');

CREATE TYPE "UserReportReason" AS ENUM ('FAKE_LISTING', 'HARASSMENT', 'SUSPICIOUS_CLAIM', 'IMPERSONATION', 'OTHER');

CREATE TYPE "UserReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "trustFlag" "TrustFlag" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "user_reviews" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" "UserReportReason" NOT NULL,
    "details" VARCHAR(1000) NOT NULL,
    "claimId" TEXT,
    "lostItemId" TEXT,
    "foundItemId" TEXT,
    "status" "UserReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_reviews_claimId_reviewerId_key" ON "user_reviews"("claimId", "reviewerId");

CREATE INDEX "user_reviews_revieweeId_idx" ON "user_reviews"("revieweeId");

CREATE INDEX "user_reviews_reviewerId_idx" ON "user_reviews"("reviewerId");

CREATE INDEX "user_reports_reporterId_idx" ON "user_reports"("reporterId");

CREATE INDEX "user_reports_reportedId_idx" ON "user_reports"("reportedId");

CREATE INDEX "user_reports_status_idx" ON "user_reports"("status");

-- AddForeignKey
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
