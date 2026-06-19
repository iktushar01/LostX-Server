# LostX Server

University lost & found API built with Express, Prisma, PostgreSQL (Neon), and better-auth.

## Deploy to Vercel

1. Import this repository as a Vercel project (root directory must be the server repo root, not a parent monorepo folder).
2. In **Project Settings → General**, set:
   - **Framework Preset**: `Other`
   - **Build Command**: leave empty (overrides in dashboard break Express routing)
   - **Output Directory**: leave empty
   - **Install Command**: leave empty (uses `vercel.json`)
3. Add every variable from `.env.example` under **Environment Variables**.
4. Run migrations once: `npx prisma migrate deploy`
5. Deploy. Vercel builds to `dist/` and serves `dist/index.js` (required for ESM `.js` imports on Node).

### Troubleshooting Vercel deploy

If you see `ERR_MODULE_NOT_FOUND` for paths like `src/config/origins` (no `.js` suffix):

- The deploy must use the compiled `dist/` output, not raw `src/` TypeScript.
- Confirm `vercel.json` has `"buildCommand": "pnpm run build"` and builds `"src": "dist/index.js"`.

If you see `404: NOT_FOUND`:

- Open **Project Settings → General** and clear any custom **Build Command** or **Output Directory** (e.g. `dist`, `.next`, `public`). Those turn the deploy into a static site with no API.
- Confirm **Root Directory** is correct (`.` for this repo, or `LostX-Server` if inside a monorepo).
- Redeploy after pushing `src/index.ts` and the latest `vercel.json`.
- In **Deployments → Build Logs**, confirm `postinstall` ran `prisma generate` successfully.

If you see `FUNCTION_INVOCATION_FAILED` or `500: INTERNAL_SERVER_ERROR`:

1. Open **Vercel → Project → Deployments → Logs** and look for `Missing required environment variables`.
2. Add every variable from `.env.example` in **Project Settings → Environment Variables** (Production + Preview).
3. Redeploy after saving env vars.
4. Hit `https://your-api.vercel.app/health` — a JSON response means the function booted successfully.

Required production values:

| Variable | Example |
|----------|---------|
| `BETTER_AUTH_URL` | `https://your-api.vercel.app` |
| `FRONTEND_URL` | `https://your-client.vercel.app` |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `CRON_SECRET` | random string from `openssl rand -hex 32` |

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
