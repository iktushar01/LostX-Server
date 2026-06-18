-- Fix embedding dimension: OpenRouter nvidia/llama-nemotron-embed model returns 2048 dims
ALTER TABLE "lost_items" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "found_items" DROP COLUMN IF EXISTS "embedding";

ALTER TABLE "lost_items" ADD COLUMN "embedding" vector(2048);
ALTER TABLE "found_items" ADD COLUMN "embedding" vector(2048);
