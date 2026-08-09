# Deploy on Vercel

Step-by-step guide to put this API on [Vercel](https://vercel.com/) with a public HTTPS URL.

Typical setup: **Vercel** (app) + **Supabase Postgres** (database). Finish the [Supabase guide](supabase.md) first (or use any Postgres with `DATABASE_URL` and pgvector).

```text
Browser / ChatGPT / Bruno
        │ HTTPS
        ▼
   Vercel (api/index.ts → Hono)
        │ DATABASE_URL
        ▼
   PostgreSQL (e.g. Supabase)
```

## What you need

| Item | Why |
| --- | --- |
| GitHub/GitLab/Bitbucket repo with this project | Vercel deploys from Git |
| [Vercel](https://vercel.com/) account | Hosting |
| Working `DATABASE_URL` | Prisma cannot start without Postgres |
| Migrations already applied on that DB | Empty DB → runtime errors |
| (Recommended) auth secrets | Do not leave production open |

Entrypoint already configured:

- [`api/index.ts`](../api/index.ts) — Hono adapter for Vercel
- [`vercel.json`](../vercel.json) — routes everything to that file

## 1. Prepare the database

1. Create a Postgres project ([Supabase](supabase.md) or other).
2. Apply migrations from your machine:

```bash
# Use the direct (non-pooler) URL for migrations — see Supabase guide
set DATABASE_URL=postgresql://...
bun run db:migrate:deploy
```

3. Confirm the DB has tables (`User`, `Movie`, …) and the `vector` extension if you want AI recommendations.

## 2. Import the project on Vercel

1. Open [vercel.com/new](https://vercel.com/new).
2. **Import** this Git repository.
3. Framework preset: leave default / Other — `vercel.json` defines the build.
4. Root directory: repository root (where `vercel.json` lives).
5. Do **not** set a custom build command unless you know you need one — Vercel uses `@vercel/node` on `api/index.ts`.
6. Click **Deploy** only after you add env vars (next section). If you already deployed once without env, add vars and **Redeploy**.

### CLI alternative

```bash
npm i -g vercel
vercel login
vercel link
vercel env add DATABASE_URL
# …add other vars the same way
vercel --prod
```

## 3. Environment variables

In the Vercel project: **Settings → Environment Variables**. Add them for **Production** (and Preview if you use preview deploys).

### Required

| Name | Example / notes |
| --- | --- |
| `DATABASE_URL` | Supabase **pooler** URL for serverless (see [supabase.md](supabase.md#connection-strings)). Include `?schema=public`. For PgBouncer transaction mode append `&pgbouncer=true` when required. |
| `NODE_ENV` | `production` |

You can use discrete `DB_*` instead of `DATABASE_URL`, but a single URL is simpler on Vercel.

### Strongly recommended for production

| Name | Example / notes |
| --- | --- |
| `AUTH_ENABLED` | `true` |
| `AUTH_METHODS` | `api_key` (or `api_key,bearer`) |
| `AUTH_TOKENS` | Long random secret(s), CSV if rotating |
| `AUTH_PUBLIC_PATHS` | `/health,/privacy,/openapi-gpt-actions.yaml` |
| `CORS_ORIGIN` | Your front-end origin(s), or `*` only if you accept open CORS |

Generate a token (example):

```bash
openssl rand -hex 32
```

### Optional (features)

| Name | When |
| --- | --- |
| `OPENAI_API_KEY` | Personalized AI recommendations |
| `OPENAI_*` / `RECOMMENDATION_ENGINE` / `AI_*` | Tune models and embedding budget — see [`.env.example`](../.env.example) |
| `LETTERBOXD_*` | Timeouts, page delay, enrichment concurrency |
| `CACHE_TTL` | In-memory cache TTL (seconds); default is fine |
| `USER_SYNC_TTL_SECONDS` | Auto re-sync freshness (default `43200`) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Per-IP limits |
| `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` | Only if outbound Letterboxd traffic must go through a proxy |
| `LOG_LEVEL` | e.g. `info` |

### Not required on Vercel

| Name | Why |
| --- | --- |
| `PORT` | Vercel assigns the port |
| `SUPABASE_URL` / `SUPABASE_KEY` | Reserved; Prisma uses `DATABASE_URL` only today |

After saving variables, trigger a **Redeploy** so the new env is applied.

## 4. Deploy and verify

1. Deploy (Git push to the linked branch, or **Deployments → Redeploy**).
2. Open your URL, for example `https://your-project.vercel.app`.
3. Check:

```bash
# Health (public)
curl "https://YOUR_HOST/health"

# Swagger UI in the browser
# https://YOUR_HOST/docs

# With auth enabled
curl -H "X-API-Key: YOUR_TOKEN" "https://YOUR_HOST/api/users/USERNAME"
```

Expected: health returns OK JSON; `/docs` loads; user routes work after DB + sync.

### First sync warning

`POST /api/users/:username/sync` (and first `GET` that triggers sync) scrapes Letterboxd and can take a long time. On Vercel Hobby, functions have a short max duration — large profiles may time out.

Practical tips:

- Start with a smaller account to confirm the pipeline.
- Prefer Pro / higher function limits if you sync large libraries in one request.
- Rely on `USER_SYNC_TTL_SECONDS` so day-to-day reads are fast after the first successful sync.
- Watch **Vercel → Deployments → Functions / Logs** for timeouts and Prisma errors.

## 5. Production checklist

- [ ] Migrations applied on the production database
- [ ] `DATABASE_URL` points at the pooler (runtime) and works from Vercel’s region
- [ ] `AUTH_ENABLED=true` and a strong `AUTH_TOKENS` value
- [ ] `/health`, `/privacy`, `/openapi-gpt-actions.yaml` stay public via `AUTH_PUBLIC_PATHS`
- [ ] `curl /health` succeeds
- [ ] Authenticated `GET /api/users/...` succeeds
- [ ] (Optional) `OPENAI_API_KEY` set and pgvector migration applied for AI recommendations

## 6. Connect ChatGPT (optional)

Public HTTPS + API key auth is enough for Custom GPT Actions:

→ [chatgpt-actions.md](chatgpt-actions.md)

Use:

- Schema: `https://YOUR_HOST/openapi-gpt-actions.yaml`
- Privacy: `https://YOUR_HOST/privacy`
- Header: `X-API-Key`

## 7. Updates and rollbacks

- **Update:** push to the production branch → Vercel rebuilds.
- **Env change:** edit variables → **Redeploy** (env alone does not restart old deployments).
- **Rollback:** Deployments → previous deployment → **Promote to Production**.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `500` / Prisma “Can’t reach database” | `DATABASE_URL`, password URL-encoding, use pooler for serverless, IP allowlist (Supabase: allow all / Vercel egress) |
| Deploy OK but empty schema errors | Run `bun run db:migrate:deploy` against that DB |
| `401 UNAUTHORIZED` | `AUTH_ENABLED`, `AUTH_TOKENS`, request header `X-API-Key` |
| Sync / enrichment timeout | Function duration limits; reduce enrichment concurrency; sync a smaller user first |
| `/docs` or GPT schema 404 | Confirm `vercel.json` routes and that `docs/chatgpt-actions.yaml` is included (`includeFiles` in `vercel.json`) |
| Cold starts feel slow | Normal for serverless + Prisma; warm with `/health` after deploy |

## Related docs

- [Supabase setup](supabase.md) — project, pgvector, connection strings, migrations
- [DEVELOPMENT.md](../DEVELOPMENT.md) — local env reference
- [api.md](api.md) — endpoints and auth behavior
- [chatgpt-actions.md](chatgpt-actions.md) — Custom GPT
