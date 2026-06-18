# LostX Server

University lost & found API built with Express, Prisma, PostgreSQL (Neon), and better-auth.

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
