-- Privacy-first item fields + AI claim verification
ALTER TABLE "lost_items" ADD COLUMN "privateDescription" TEXT;
ALTER TABLE "lost_items" ADD COLUMN "showImagePublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lost_items" ADD COLUMN "showDescriptionPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lost_items" ADD COLUMN "showLocationPublic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "found_items" ADD COLUMN "privateDescription" TEXT;
ALTER TABLE "found_items" ADD COLUMN "showImagePublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "found_items" ADD COLUMN "showDescriptionPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "found_items" ADD COLUMN "showLocationPublic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "claims" ADD COLUMN "aiQuestions" JSONB;
ALTER TABLE "claims" ADD COLUMN "aiAnswers" JSONB;
ALTER TABLE "claims" ADD COLUMN "aiConfidence" INTEGER;
ALTER TABLE "claims" ADD COLUMN "aiRecommendation" TEXT;
