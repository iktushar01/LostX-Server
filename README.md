# LostX Server

REST API for **LostX** — a university lost-and-found platform. Handles authentication, item listings, smart matching, AI-powered search, claim verification, admin moderation, and notifications.

Built with Express, Prisma, PostgreSQL (Neon), and better-auth. Deployed as a Vercel serverless function.

---

## Features

### Core platform
- **Authentication** — email/password, email OTP verification, Google OAuth (better-auth)
- **Users & profiles** — roles (USER, STAFF, ADMIN), trust flags, reviews, and reports
- **Lost items** — CRUD with photos, campus location, privacy controls, and verification secrets
- **Found items** — CRUD with linking to lost reports
- **Browse & search** — filter by category, status, keyword, and location
- **Smart matching** — score-based matching between lost and found items
- **Claims** — ownership claims with verification answers and AI-assisted questions
- **Claim messaging** — in-thread chat between claimant and finder after approval
- **Notifications** — email + in-app for claims, matches, and item updates
- **Admin panel API** — manage users, items, claims, featured listings, and user reports
- **Dashboard stats** — aggregated metrics for users and admins
- **Item expiry** — daily cron archives stale listings after configurable days
- **Audit logs** — track admin actions on claims and items
- **Privacy** — encrypt sensitive item details at rest (`ENCRYPTION_KEY`)

### AI & search
- **RAG chatbot** — natural-language search over lost/found items using OpenRouter embeddings + LLM
- **pgvector semantic search** — cosine similarity on item embeddings stored in PostgreSQL
- **AI claim verification** — auto-generate verification questions from private item details
- **Auto-approve** — high-confidence AI matches can auto-approve claims (configurable threshold)

### Media & email
- **Image uploads** — Cloudinary and ImgBB
- **Email** — OTP verification, claim status, and password reset via SMTP (Nodemailer + EJS templates)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+, Express 5 |
| Language | TypeScript (ES modules) |
| Database | PostgreSQL (Neon) via Prisma 7 |
| DB adapter | `@prisma/adapter-pg` + `pg` |
| Vector search | pgvector extension |
| Auth | better-auth (sessions, OAuth, email OTP) |
| Validation | Zod |
| AI | OpenRouter (embeddings + LLM) |
| File storage | Cloudinary, ImgBB |
| Email | Nodemailer + EJS templates |
| Deployment | Vercel serverless (`@vercel/node`) |

---

## Architecture & request flow

```mermaid
flowchart TB
  subgraph Vercel
    Entry["api/index.ts"]
    Express["src/app.ts (Express)"]
  end

  subgraph Routes
    Auth["/api/auth/* → better-auth"]
    V1["/api/v1/* → REST routes"]
    Health["/health"]
    Cron["/api/cron/expiry"]
  end

  subgraph Modules
    Lost[Lost Items]
    Found[Found Items]
    Claim[Claims]
    Match[Matches]
    Chatbot[Chatbot RAG]
    Admin[Admin]
    Notify[Notifications]
  end

  subgraph Data
    Prisma[Prisma Client]
    Neon[(Neon PostgreSQL + pgvector)]
  end

  Client[LostX Client] --> Entry
  Entry --> Express
  Express --> Auth
  Express --> V1
  Express --> Health
  Express --> Cron
  V1 --> Lost & Found & Claim & Match & Chatbot & Admin & Notify
  Lost --> Prisma
  Found --> Prisma
  Claim --> Prisma
  Chatbot --> Prisma
  Prisma --> Neon
  Auth --> Prisma
```

### API route map

All REST endpoints are under `/api/v1`:

| Prefix | Module | Purpose |
|--------|--------|---------|
| `/api/auth/*` | better-auth | Login, register, OAuth, sessions |
| `/api/v1/auth/*` | Auth | Custom auth helpers, Google callback |
| `/api/v1/users/*` | Users | Profiles, trust, reviews, reports |
| `/api/v1/lost-items/*` | Lost Items | CRUD, search, privacy |
| `/api/v1/found-items/*` | Found Items | CRUD, search, linking |
| `/api/v1/claims/*` | Claims | Submit, verify, approve, messaging |
| `/api/v1/matches/*` | Matches | Smart matching scores |
| `/api/v1/notifications/*` | Notifications | Read/mark notifications |
| `/api/v1/chatbot/*` | Chatbot | AI chat + admin reindex |
| `/api/v1/dashboard/*` | Dashboard | User/admin stats |
| `/api/v1/admin/*` | Admin | Moderation, featured items, reports |

Utility endpoints:
- `GET /` — server status
- `GET /health` — config + environment check
- `GET /api/cron/expiry` — daily item expiry (requires `CRON_SECRET`)

---

## Prerequisites

- **Node.js** 20+
- **npm** (use `package-lock.json`; do not add `pnpm-lock.yaml`)
- **Neon PostgreSQL** database with `pgvector` extension enabled
- **Cloudinary** account (or ImgBB) for image uploads
- **SMTP** credentials for email (e.g. Gmail app password)
- **Google OAuth** credentials (optional, for Google login)
- **OpenRouter API key** (optional, for AI chatbot and claim verification)

---

## Local installation

### 1. Clone and install

```bash
git clone https://github.com/iktushar01/LostX.git
cd LostX/LostX-Server   # or your server folder path
npm install
```

`postinstall` automatically runs `prisma generate`.

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in all required values. Minimum for local dev:

```env
PORT=5000
NODE_ENV=development
BETTER_AUTH_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require

BETTER_AUTH_SECRET=openssl_rand_hex_32
ACCESS_TOKEN_SECRET=openssl_rand_hex_32
REFRESH_TOKEN_SECRET=openssl_rand_hex_32
ACCESS_TOKEN_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_IN=7d
BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN=1d
BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE=1d

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM="LostX <your@gmail.com>"
EXPIRE_OTP_TIME=15m

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/callback/google

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
IMGBB_API_KEY=

SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=secure_password

ENCRYPTION_KEY=openssl_rand_hex_32
```

Generate secrets:

```bash
openssl rand -hex 32   # for BETTER_AUTH_SECRET, ACCESS_TOKEN_SECRET, etc.
```

For AI chatbot (optional):

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
OPENROUTER_LLM_MODEL=nvidia/nemotron-3-super-120b-a12b:free
CHATBOT_TOP_K=5
CHATBOT_MIN_SIMILARITY=0.55
CHATBOT_EMBEDDING_DIMENSION=2048
```

### 3. Database setup

Enable `pgvector` on your Neon database, then run migrations:

```bash
npx prisma migrate dev
```

For production:

```bash
npx prisma migrate deploy
```

### 4. Start the server

```bash
npm run dev
```

Server runs at [http://localhost:5000](http://localhost:5000).

Verify:

```bash
curl http://localhost:5000/health
# {"success":true,"message":"LostX API is healthy","environment":"development"}
```

### 5. Start the client

In the client repo, point `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:5000/api/v1` and run `pnpm dev`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Generate Prisma client + start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/`, copy Prisma client and templates |
| `npm start` | Run compiled server (`node dist/server.js`) |
| `npm run vercel-build` | Production build for Vercel deploy |
| `npm run backfill:embeddings` | Index existing items for AI search |

---

## Project structure

```
api/
└── index.ts              # Vercel serverless entry (exports Express app)

src/
├── app.ts                # Express app, CORS, routes, middleware
├── server.ts             # Local dev entry (app.listen)
├── config/               # env, origins, cloudinary, multer
├── app/
│   ├── lib/              # prisma, auth (better-auth)
│   ├── middleware/       # auth, validation, error handling
│   ├── module/           # feature modules (lost-item, claim, chatbot, admin, …)
│   ├── routes/           # API route aggregator
│   ├── templates/        # EJS email templates
│   └── utils/            # email, encryption, uploads, seed
└── generated/prisma/     # Generated Prisma client (gitignored, built at install)

prisma/
├── schema.prisma         # Database schema
└── migrations/           # SQL migrations (includes pgvector)
```

---

## Prisma & serverless notes

- Prisma client is generated to `src/generated/prisma` (not committed — built via `postinstall`).
- Uses a **singleton PrismaClient** pattern to reuse connections across warm serverless invocations.
- Use Neon's **pooled connection string** (`-pooler` host) in `DATABASE_URL` for Vercel.
- Relative imports use `.js` extensions (required for Node ESM on Vercel).

---

## AI chatbot (RAG + pgvector)

### Prerequisites

1. Neon PostgreSQL with `pgvector` enabled
2. Migrations applied: `npx prisma migrate deploy`
3. OpenRouter env vars set (see above)

### Backfill embeddings

After migration, index existing items:

```bash
npm run backfill:embeddings
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
  "message": "I lost my black calculator near the library yesterday"
}
```

### RAG workflow

1. Embed the user query (OpenRouter embeddings)
2. Search `lost_items` and `found_items` with pgvector cosine similarity
3. Build context from retrieved rows only
4. Send context + query to the LLM with strict no-hallucination rules
5. Persist the exchange in `chat_logs`
6. On LLM failure, return a retrieval-only fallback answer

New and updated items automatically schedule embedding generation in the background.

---

## Deploy to Vercel

1. Import this repo as a Vercel project (root = server repo).
2. **Framework Preset**: `Other`
3. **Build / Output Directory**: leave empty in dashboard (controlled by `vercel.json`)
4. **Install Command**: leave empty (uses npm via `package-lock.json`)
5. Add every variable from `.env.example` under **Environment Variables** (Production + Preview).
6. Run migrations once against production Neon:

```bash
npx prisma migrate deploy
```

7. Deploy. Entry point is `api/index.ts` → `src/app.ts`.

| Variable | Production example |
|----------|-------------------|
| `BETTER_AUTH_URL` | `https://lost-x-server.vercel.app` |
| `FRONTEND_URL` | `https://lost-x.vercel.app` |
| `DATABASE_URL` | Neon pooled PostgreSQL URL |
| `CRON_SECRET` | `openssl rand -hex 32` |

Preview deployments automatically allow `VERCEL_URL` for CORS. For extra preview domains, set `ALLOWED_ORIGINS`.

### Verify after deploy

```bash
curl https://lost-x-server.vercel.app/health
curl https://lost-x-server.vercel.app/
```

Both should return `200 OK`.

### Common deploy issues

| Error | Cause | Fix |
|-------|-------|-----|
| `404 NOT_FOUND` | No serverless function routed to `/` | Use `api/index.ts` entry in `vercel.json`; clear Output Directory in dashboard |
| `FUNCTION_INVOCATION_FAILED` | Missing env vars or ESM import errors | Set all `.env.example` vars; ensure relative imports use `.js` suffix |
| `Cannot find package 'express'` | pnpm lockfile caused broken bundling | Use npm only (`package-lock.json`); remove `pnpm-lock.yaml` |
| `Cannot find module .../env` | Missing `.js` in ESM imports | All relative imports must end with `.js` |
| `/health` returns 503 | Missing required environment variables | Check response body for `configError` list |

---

## Related

- **Frontend**: [LostX-Client](../LostX-Client)
- **Production API**: https://lost-x-server.vercel.app
- **Production client**: https://lost-x.vercel.app
