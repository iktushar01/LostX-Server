-- AlterTable
ALTER TABLE "lost_items" ADD COLUMN "verificationQuestion" TEXT;
ALTER TABLE "lost_items" ADD COLUMN "verificationAnswer" TEXT;

-- AlterTable
ALTER TABLE "claims" ADD COLUMN "lostItemId" TEXT;
ALTER TABLE "claims" RENAME COLUMN "message" TO "answer";

-- CreateIndex
CREATE INDEX "claims_lostItemId_idx" ON "claims"("lostItemId");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_lostItemId_fkey" FOREIGN KEY ("lostItemId") REFERENCES "lost_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
