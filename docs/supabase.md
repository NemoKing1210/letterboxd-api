# Connect Supabase (PostgreSQL)

Step-by-step guide to use [Supabase](https://supabase.com/) as the Postgres database for this API.

The app talks to Supabase **only through Prisma** (`DATABASE_URL`). You do **not** need the Supabase JS client for the current feature set. `SUPABASE_URL` / `SUPABASE_KEY` in [`.env.example`](../.env.example) are reserved for future use and can stay empty.

```text
Local Bun / Vercel API
        │ Prisma
        │ DATABASE_URL
        ▼
   Supabase Postgres (+ pgvector)
```

## What you need

| Item | Why |
| --- | --- |
| [Supabase](https://supabase.com/) account | Hosted Postgres |
| Bun locally | Run migrations (`bun run db:migrate:deploy`) |
| This repository cloned | Migration files live in `prisma/migrations/` |

After Supabase is ready, deploy the API with the [Vercel guide](vercel.md) (or keep running locally against Supabase).

## 1. Create a Supabase project

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Choose organization, **name**, **database password**, and **region**.
3. Save the database password in a password manager — you need it for `DATABASE_URL`. Prefer a password **without** `@`, `#`, `%`, etc., or you must [URL-encode](#password-with-special-characters) it in the connection string.
4. Wait until the project status is healthy (green).

## 2. Enable pgvector

AI recommendations store embeddings in `vector(1536)` columns. Migrations run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Make sure the extension is allowed:

1. Dashboard → **Database** → **Extensions**.
2. Search for **vector** (`pgvector`).
3. Enable it if it is not already on.

On most Supabase plans the extension is available; enabling it here avoids migration failures.

## 3. Connection strings

Dashboard → **Project Settings** → **Database** → **Connection string**.

You will use **two** URLs in practice:

| Use | Which string | Port / mode |
| --- | --- | --- |
| **Migrations** (`db:migrate:deploy`) from your PC | **Direct** connection | Host `db.<project-ref>.supabase.co`, port **5432** |
| **App runtime** (local Bun or Vercel) | **Pooler** (Transaction) | Pooler host, port **6543**, often with `pgbouncer=true` |

Prisma always needs a URL shaped like:

```text
postgresql://USER:PASSWORD@HOST:PORT/postgres?schema=public
```

### Direct (migrations)

Example shape (copy yours from the dashboard):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?schema=public"
```

### Pooler (app / Vercel)

Prefer the **Transaction** pooler URI from the dashboard. Add `schema=public`. If you use PgBouncer transaction mode, add `pgbouncer=true`:

```env
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?schema=public&pgbouncer=true"
```

Exact username/host text changes over time in the Supabase UI — **copy from the dashboard**, then only append `schema` / `pgbouncer` query params as needed.

### Password with special characters

If the password contains reserved URL characters, encode them in the URL:

| Character | Encoded |
| --- | --- |
| `@` | `%40` |
| `#` | `%23` |
| `%` | `%25` |
| `/` | `%2F` |
| `:` | `%3A` |
| `?` | `%3F` |

Example: password `p@ss` → userinfo `postgres:p%40ss`.

### IPv4 / network

- Local migrations: your IP must reach Supabase (default allows connections; check **Database → Network** / bans if connect fails).
- Vercel: use the **pooler** URL; do not rely on a single static IP unless you configure allowlists accordingly.

## 4. Apply Prisma migrations

From the repo root, with the **direct** `DATABASE_URL`:

```bash
bun install

# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public"
bun run db:migrate:deploy

# macOS / Linux
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public"
bun run db:migrate:deploy
```

Or put the direct URL into a local `.env` (never commit it):

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public
```

Then:

```bash
bun run db:migrate:deploy
```

Success looks like Prisma applying migrations under `prisma/migrations/` with no error. Optionally open **Table Editor** in Supabase and confirm tables (`User`, `Movie`, `UserMovie`, `SyncHistory`, embedding tables, …).

### Dev vs deploy commands

| Command | When |
| --- | --- |
| `bun run db:migrate:deploy` | **Production / Supabase** — applies existing migrations |
| `bun run db:migrate` | Local **dev** only — can create new migration files |

Do not use `migrate dev` against a shared production Supabase project.

## 5. Point the app at Supabase

### Local development

In `.env`, prefer the **pooler** URL for day-to-day `bun run dev` (same as production), or direct if you prefer:

```env
DATABASE_URL=postgresql://postgres.YOUR_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?schema=public&pgbouncer=true

NODE_ENV=development
# …rest from .env.example
```

You can leave discrete `DB_*` empty when `DATABASE_URL` is set (`DATABASE_URL` wins).

```bash
bun run dev
curl "http://localhost:3000/health"
```

### Vercel / production

1. Set `DATABASE_URL` in Vercel to the **pooler** URL.
2. Keep using the **direct** URL only on your machine when running `db:migrate:deploy`.
3. Follow [vercel.md](vercel.md) for the rest of the env vars (`AUTH_*`, optional `OPENAI_API_KEY`, …).

## 6. Verify end-to-end

```bash
# Health
curl "http://localhost:3000/health"
# or https://YOUR_VERCEL_HOST/health

# Sync a Letterboxd user (slow first time)
curl -X POST "http://localhost:3000/api/users/USERNAME/sync"
# with auth:
curl -X POST -H "X-API-Key: YOUR_TOKEN" "https://YOUR_HOST/api/users/USERNAME/sync"
```

In Supabase **Table Editor**, you should see rows in `User` / `Movie` / `UserMovie` after a successful sync.

## 7. Optional: Supabase Dashboard extras

Useful, not required by the API:

| Feature | Use |
| --- | --- |
| **Table Editor** | Inspect synced data |
| **SQL Editor** | Ad-hoc checks (`SELECT COUNT(*) FROM "User";`) |
| **Database → Roles** | Do not change the `postgres` password without updating `DATABASE_URL` everywhere |
| **Auth / Storage / Edge Functions** | Not used by this API today |

`SUPABASE_URL` and `SUPABASE_KEY` are optional placeholders in env parsing — leaving them unset is fine.

## Checklist

- [ ] Supabase project created; DB password saved
- [ ] `vector` (pgvector) extension enabled
- [ ] Direct `DATABASE_URL` works for migrations
- [ ] `bun run db:migrate:deploy` completed successfully
- [ ] App / Vercel uses pooler `DATABASE_URL` with `schema=public`
- [ ] `/health` works against that database
- [ ] Test sync writes rows visible in Table Editor

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `P1001: Can't reach database server` | Wrong host/port; network; use dashboard URI; check project paused (free tier) |
| `P1000` / authentication failed | Wrong password; URL-encode special characters |
| `extension "vector" is not available` | Enable **vector** under Database → Extensions, re-run migrate |
| Migrations OK, Vercel fails to connect | Switch runtime URL to **pooler**; ensure `schema=public` |
| `prepared statement` / PgBouncer errors | Add `pgbouncer=true` on the pooler URL; use direct URL only for migrations |
| Project paused | Resume in dashboard, then retry |

## Related docs

- [Deploy on Vercel](vercel.md)
- [Database overview](database.md)
- [DEVELOPMENT.md](../DEVELOPMENT.md) — full env table
- [architecture.md](architecture.md) — how Prisma is wired
