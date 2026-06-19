-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'POSSIBLE_RETURN';

-- AlterTable
ALTER TABLE "found_items" ADD COLUMN "linkedLostItemId" TEXT;

-- CreateIndex
CREATE INDEX "found_items_linkedLostItemId_idx" ON "found_items"("linkedLostItemId");

-- AddForeignKey
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_linkedLostItemId_fkey" FOREIGN KEY ("linkedLostItemId") REFERENCES "lost_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
