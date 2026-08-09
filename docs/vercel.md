# Deploy on Vercel

Step-by-step guide to put this API on [Vercel](https://vercel.com/) with a public HTTPS URL.

Typical setup: **Vercel** (app) + **Supabase Postgres** (database). Finish the [Supabase guide](supabase.md) first (or use any Postgres with `DATABASE_URL` and pgvector).

```text
Browser / ChatGPT / Bruno
        │ HTTPS
        ▼
   Vercel (api/index.ts → Hono)
        │ DATABASE_URL (pooler)
        ▼
   PostgreSQL (e.g. Supabase)
```

## What you need

| Item                                           | Why                                             |
| ---------------------------------------------- | ----------------------------------------------- |
| GitHub/GitLab/Bitbucket repo with this project | Vercel deploys from Git (and/or GitHub Actions) |
| [Vercel](https://vercel.com/) account          | Hosting                                         |
| Working `DATABASE_URL` (pooler)                | Prisma cannot start without Postgres            |
| Migrations already applied on that DB          | Empty DB → runtime errors                       |
| (Recommended) auth secrets                     | Do not leave production open                    |

Entrypoint already configured:

- [`api/index.ts`](../api/index.ts) — Hono adapter for Vercel
- [`vercel.json`](../vercel.json) — rewrites, `maxDuration`, Prisma generate on build

Minimal env list for the dashboard: [`.env.vercel.example`](../.env.vercel.example).

## Fast path (recommended)

```bash
# 1. One-time: CLI + link + pull env (after vars exist in the Vercel project)
bun add -g vercel   # or: npm i -g vercel
bun run setup:vercel

# 2. Migrations against Direct or Session pooler (not transaction :6543)
#    Windows PowerShell: $env:DATABASE_URL="postgresql://..."
export DATABASE_URL="postgresql://...migrate-capable..."
bun run db:migrate:deploy

# 3. Local check against the Vercel runtime shape
bun run vercel:dev

# 4. Production deploy
bun run deploy
```

`bun run setup:vercel` runs `vercel link` (if needed) and `vercel env pull .env.local`.

### GitHub Actions (optional)

Prefer **Supabase GitHub integration** to apply `supabase/migrations/` on merge (no production DB URL in Actions) — see [supabase.md](supabase.md#github-integration-migrations). Use Actions below only if you want Prisma `migrate deploy` from CI.

On push to `main`, CI can migrate + deploy when these repository secrets exist:

| Secret                | Value                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `VERCEL_TOKEN`        | [Vercel token](https://vercel.com/account/tokens)                                                                                          |
| `VERCEL_ORG_ID`       | From `.vercel/project.json` after `vercel link`                                                                                            |
| `VERCEL_PROJECT_ID`   | Same file                                                                                                                                  |
| `DATABASE_URL_DIRECT` | Supabase **Direct** or **Session pooler** URL (migrations only — not transaction `:6543`). Skip if you use Supabase GitHub for migrations. |

Without those secrets, the migrate/deploy jobs no-op so forks stay green.

You can still use Vercel’s native Git integration instead of (or in addition to) the Actions deploy job — avoid double-deploying production from both.

## 1. Prepare the database

1. Create a Postgres project ([Supabase](supabase.md) or other).
2. Apply migrations once — pick **one** path:

   - **Supabase GitHub** (recommended for open-source hosts): connect the repo and enable **Deploy to production** ([details](supabase.md#github-integration-migrations)), **or**
   - **Manual Prisma** from your machine:

```bash
# Use Direct or Session pooler for migrations — NOT transaction :6543
# See docs/supabase.md (IPv4-only networks often need Session pooler)
export DATABASE_URL=postgresql://...
bun run db:migrate:deploy
```

3. Confirm the DB has tables (`User`, `Movie`, …) and the `vector` extension if you want AI recommendations.

## 2. Import the project on Vercel

1. Open [vercel.com/new](https://vercel.com/new).
2. **Import** this Git repository.
3. Framework preset: Other / no framework — `vercel.json` defines rewrites and the build.
4. Root directory: repository root (where `vercel.json` lives).
5. Build command is already `bun run db:generate` via `vercel.json` (Prisma client). Override only if you know you need to.
6. Click **Deploy** only after you add env vars (next section). If you already deployed once without env, add vars and **Redeploy**.

Optional: install the [Supabase integration](https://vercel.com/integrations/supabase) so `DATABASE_URL` is injected for you — still prefer the **transaction pooler** (`:6543` + `pgbouncer=true`) for the app runtime.

### Region (latency)

Pin the function region next to your Supabase project in `vercel.json` when you know it, for example:

```json
"regions": ["fra1"]
```

Common codes: `fra1` (Frankfurt), `iad1` (Washington), `sfo1` (San Francisco). Match [Supabase project region](https://supabase.com/docs/guides/platform/regions).

## 3. Environment variables

In the Vercel project: **Settings → Environment Variables**. Add them for **Production** (and Preview if you use preview deploys). Start from [`.env.vercel.example`](../.env.vercel.example).

After the first save, pull locally anytime:

```bash
bun run vercel:env
# or: bun run setup:vercel
```

### Required

| Name           | Example / notes                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Supabase **transaction pooler** (Supavisor port **6543**) for serverless — see [supabase.md](supabase.md#connection-strings). Include `?schema=public&pgbouncer=true` so Prisma disables prepared statements. |
| `NODE_ENV`     | `production`                                                                                                                                                                                                  |

You can use discrete `DB_*` instead of `DATABASE_URL`, but a single URL is simpler on Vercel.

### Strongly recommended for production

| Name                | Example / notes                                               |
| ------------------- | ------------------------------------------------------------- |
| `AUTH_ENABLED`      | `true`                                                        |
| `AUTH_METHODS`      | `api_key` (or `api_key,bearer`)                               |
| `AUTH_TOKENS`       | Long random secret(s), CSV if rotating                        |
| `AUTH_PUBLIC_PATHS` | `/health,/privacy,/openapi-gpt-actions.yaml`                  |
| `CORS_ORIGIN`       | Your front-end origin(s), or `*` only if you accept open CORS |

Generate a token (example):

```bash
openssl rand -hex 32
```

### Optional (features)

| Name                                          | When                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `OPENAI_API_KEY`                              | Personalized AI recommendations                                          |
| `OPENAI_*` / `RECOMMENDATION_ENGINE` / `AI_*` | Tune models and embedding budget — see [`.env.example`](../.env.example) |
| `LETTERBOXD_*`                                | Timeouts, page delay, enrichment concurrency                             |
| `CACHE_TTL`                                   | In-memory cache TTL (seconds); default is fine                           |
| `USER_SYNC_TTL_SECONDS`                       | Auto re-sync freshness (default `43200`)                                 |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`     | Per-IP limits                                                            |
| `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`     | Only if outbound Letterboxd traffic must go through a proxy              |
| `LOG_LEVEL`                                   | e.g. `info`                                                              |

### Not required on Vercel

| Name                            | Why                                             |
| ------------------------------- | ----------------------------------------------- |
| `PORT`                          | Vercel assigns the port                         |
| `SUPABASE_URL` / `SUPABASE_KEY` | Reserved; Prisma uses `DATABASE_URL` only today |

After saving variables, trigger a **Redeploy** so the new env is applied.

## 4. Deploy and verify

1. Deploy (`bun run deploy`, Git push to the linked branch, or **Deployments → Redeploy**).
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

`POST /api/users/:username/sync` (and first `GET` that triggers sync) scrapes Letterboxd and can take a long time. `vercel.json` sets `maxDuration` to **60s** (requires [Pro](https://vercel.com/docs/functions/configuring-functions/duration) or higher). On Hobby the platform caps lower — large profiles may still time out.

Practical tips:

- Start with a smaller account to confirm the pipeline.
- Prefer Pro / higher function limits if you sync large libraries in one request.
- Rely on `USER_SYNC_TTL_SECONDS` so day-to-day reads are fast after the first successful sync.
- Watch **Vercel → Deployments → Functions / Logs** for timeouts and Prisma errors.
- For Hobby, lower `functions.api/index.ts.maxDuration` in `vercel.json` to your plan limit (e.g. `10`) so deploys do not fail validation.

## 5. Production checklist

- [ ] Migrations applied on the production database
- [ ] `DATABASE_URL` points at the transaction pooler (`:6543`, `pgbouncer=true`) and works from Vercel’s region
- [ ] Optional: `regions` in `vercel.json` matches Supabase
- [ ] `AUTH_ENABLED=true` and a strong `AUTH_TOKENS` value
- [ ] `/health`, `/privacy`, `/openapi-gpt-actions.yaml` stay public via `AUTH_PUBLIC_PATHS`
- [ ] `curl /health` succeeds
- [ ] Authenticated `GET /api/users/...` succeeds
- [ ] (Optional) `OPENAI_API_KEY` set and pgvector migration applied for AI recommendations
- [ ] (Optional) GitHub secrets for Actions migrate/deploy

## 6. Connect ChatGPT (optional)

Public HTTPS + API key auth is enough for Custom GPT Actions:

→ [chatgpt-actions.md](chatgpt-actions.md)

Use:

- Schema: `https://YOUR_HOST/openapi-gpt-actions.yaml`
- Privacy: `https://YOUR_HOST/privacy`
- Header: `X-API-Key`

## 7. Updates and rollbacks

- **Update:** push to the production branch → Vercel rebuilds (and Actions deploy if secrets are set).
- **Env change:** edit variables → **Redeploy** (env alone does not restart old deployments). Pull locally with `bun run vercel:env`.
- **Rollback:** Deployments → previous deployment → **Promote to Production**.

## Troubleshooting

| Symptom                                | What to check                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `500` / Prisma “Can’t reach database”  | `DATABASE_URL` must be transaction pooler for Vercel; password URL-encoding; IPv4 vs IPv6 (see [supabase.md](supabase.md)); project paused / network restrictions |
| Deploy OK but empty schema errors      | Run `bun run db:migrate:deploy` against that DB (direct URL)                                                                                                      |
| `401 UNAUTHORIZED`                     | `AUTH_ENABLED`, `AUTH_TOKENS`, request header `X-API-Key`                                                                                                         |
| Sync / enrichment timeout              | Function `maxDuration` / plan limits; reduce enrichment concurrency; sync a smaller user first                                                                    |
| Deploy fails on `maxDuration`          | Hobby plan — set `maxDuration` to `10` in `vercel.json`                                                                                                           |
| `/docs` or GPT schema 404              | Confirm `vercel.json` rewrites and that `docs/chatgpt-actions.yaml` is included (`includeFiles`)                                                                  |
| Cold starts feel slow                  | Normal for serverless + Prisma; pin `regions`; warm with `/health` after deploy                                                                                   |
| `vercel build` / Prisma client missing | `buildCommand` runs `bun run db:generate`; `postinstall` also generates the client                                                                                |

## Related docs

- [Supabase setup](supabase.md) — project, pgvector, connection strings, migrations
- [DEVELOPMENT.md](../DEVELOPMENT.md) — local env reference and scripts
- [api.md](api.md) — endpoints and auth behavior
- [chatgpt-actions.md](chatgpt-actions.md) — Custom GPT
