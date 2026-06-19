# LostX Server

University lost & found API built with Express, Prisma, PostgreSQL (Neon), and better-auth.

## Deploy to Vercel

1. Import this repository as a separate Vercel project (root directory: `LostX-Server` if using a monorepo).
2. Copy `.env.example` to Vercel environment variables. Important production values:
   - `NODE_ENV=production`
   - `BETTER_AUTH_URL` — your deployed API URL (e.g. `https://lostx-api.vercel.app`)
   - `FRONTEND_URL` — your deployed client URL (e.g. `https://lostx.vercel.app`)
   - `GOOGLE_CALLBACK_URL` — `{BETTER_AUTH_URL}/api/v1/auth/google/callback` (or your OAuth callback path)
   - `CRON_SECRET` — random secret for the daily item-expiry cron (`openssl rand -hex 32`)
   - `DATABASE_URL` — Neon PostgreSQL connection string with `pgvector` enabled
3. Run database migrations before first deploy:
   ```bash
   npx prisma migrate deploy
   ```
4. Deploy. Vercel detects `src/server.ts` as the Express entry point.

Preview deployments automatically allow the current `VERCEL_URL` for CORS and better-auth. For extra preview domains, set `ALLOWED_ORIGINS` as a comma-separated list.

## Chatbot (RAG + pgvector)

The AI chatbot helps users find lost or found items using semantic search and OpenRouter.

### Prerequisites

1. **Neon PostgreSQL** with the `pgvector` extension enabled.
2. Run migrations:

```bash
npx prisma migrate deploy
```

3. Set OpenRouter environment variables in `.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
OPENROUTER_LLM_MODEL=nvidia/nemotron-3-super-120b-a12b:free
CHATBOT_TOP_K=5
CHATBOT_MIN_SIMILARITY=0.55
CHATBOT_EMBEDDING_DIMENSION=1024
ENCRYPTION_KEY=your_64_char_hex_key_here
AI_AUTO_APPROVE_CONFIDENCE=80
AUTO_APPROVE_MATCH_THRESHOLD=85
```

`ENCRYPTION_KEY` must be 32 bytes — use `openssl rand -hex 32` to generate a 64-character hex key. Used to encrypt private item details at rest.

### AI claim verification

When claiming a found item, the server generates verification questions from encrypted private lost/found details using OpenRouter. Set `OPENROUTER_API_KEY` and optionally `AI_AUTO_APPROVE_CONFIDENCE` (default 80).

```http
POST /api/v1/claims/verification-questions
{ "foundItemId": "...", "lostItemId": "..." }

POST /api/v1/claims
{ "foundItemId": "...", "lostItemId": "...", "aiQuestions": [...], "aiAnswers": [...] }
```

> If embeddings fail with a dimension mismatch, inspect one embedding response from OpenRouter and update `CHATBOT_EMBEDDING_DIMENSION` plus the migration `vector(N)` columns to match.

### Backfill embeddings

After migration, index existing items:

```bash
pnpm run backfill:embeddings
```

Or call the admin endpoint:

```http
POST /api/v1/chatbot/reindex
Authorization: Bearer <admin-access-token>
```

### Chat API

```http
POST /api/v1/chatbot/chat
Content-Type: application/json

{
  "message": "I lost my black calculator near EEE building yesterday"
}
```

Response:

```json
{
  "success": true,
  "message": "Chat response generated",
  "data": {
    "answer": "We found 2 possible matches...",
    "matches": [],
    "meta": { "matchCount": 0, "topSimilarity": null }
  }
}
```

### RAG workflow

1. Embed the user query (OpenRouter embeddings).
2. Search `lost_items` and `found_items` with pgvector cosine similarity.
3. Build a grouped context block from retrieved rows only.
4. Send context + query to the LLM with strict no-hallucination rules.
5. Persist the exchange in `chat_logs`.
6. On LLM failure, return a retrieval-only fallback answer.

New and updated lost/found items automatically schedule embedding generation in the background.
