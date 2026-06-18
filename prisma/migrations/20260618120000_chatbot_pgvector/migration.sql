-- Enable pgvector for semantic search (Neon PostgreSQL)
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding columns for RAG chatbot (dimension must match OpenRouter embedding model output)
ALTER TABLE "lost_items" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
ALTER TABLE "found_items" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

-- Chat history for the AI assistant
CREATE TABLE IF NOT EXISTS "chat_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "matches" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_logs_userId_idx" ON "chat_logs"("userId");
CREATE INDEX IF NOT EXISTS "chat_logs_createdAt_idx" ON "chat_logs"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_logs_userId_fkey'
    ) THEN
        ALTER TABLE "chat_logs"
        ADD CONSTRAINT "chat_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
