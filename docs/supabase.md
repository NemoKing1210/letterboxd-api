# Connect Supabase (PostgreSQL)

Step-by-step guide to use [Supabase](https://supabase.com/) as the Postgres database for this API.

Verified against current Supabase docs ([Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [Prisma](https://supabase.com/docs/guides/database/prisma), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)). Dashboard labels move over time — prefer the in-dashboard **Connect** dialog over memorized menu paths.

The app talks to Supabase **only through Prisma** (`DATABASE_URL`). You do **not** need the Supabase JS client or the Data API for the current feature set. `SUPABASE_URL` / `SUPABASE_KEY` in [`.env.example`](../.env.example) are reserved for future use and can stay empty.

```text
Local Bun / Vercel API
        │ Prisma
        │ DATABASE_URL
        ▼
   Supabase Postgres (+ pgvector)
   (prefer Supavisor transaction pooler at runtime)
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
2. Choose organization, **name**, **database password**, and **region** (pick a region close to your Vercel `regions` if you deploy there).
3. Save the database password in a password manager — you need it for connection strings. Prefer a password **without** `@`, `#`, `%`, etc., or you must [URL-encode](#password-with-special-characters) it in the URI.
4. Wait until the project status is healthy (green).

### Project options that matter for this API

| Setting | Recommendation for Letterboxd API |
| --- | --- |
| **Data API** (“Automatically expose new tables…”) | Optional. This app uses Prisma over a Postgres connection string, not PostgREST / `supabase-js`. You can leave the Data API on for Table Editor convenience, or [turn it off](https://supabase.com/dashboard/project/_/settings/api) if you only use Prisma (official Prisma guide suggestion). |
| **Auth / Storage / Edge Functions** | Not used by this API today |

Prisma connections are **not** affected by the [Data API default-grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) (rollout through 2026-10-30). That change only affects REST/GraphQL/`supabase-js` access.

## 2. Enable pgvector

AI recommendations store embeddings in `vector(1536)` columns. The migration under `prisma/migrations/` runs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Make sure the extension is allowed before migrating:

1. Dashboard → **Database** → **Extensions** (or search **Extensions** in the sidebar).
2. Search for **vector** (`pgvector`).
3. Enable it if it is not already on.

On most Supabase plans the extension is available; enabling it here avoids migration failures. Official docs also show `create extension vector with schema extensions;` — either works; our Prisma migration uses the simpler form above.

## 3. Connection strings

Open the project dashboard and click **[Connect](https://supabase.com/dashboard/project/_?showConnect=true)** (top of the project). Copy the URI for the mode you need — do not invent hosts from memory.

Supabase exposes several ways to reach Postgres. For this repo you typically need **two**:

| Use | Mode | Host / port (typical) | IP |
| --- | --- | --- | --- |
| **Migrations** (`db:migrate:deploy`) | **Direct** *or* **Session pooler** | `db.<project-ref>.supabase.co:5432` *or* `aws-<region>.pooler.supabase.com:5432` | Direct is **IPv6** by default; session pooler is **IPv4** |
| **App runtime** (local Bun or Vercel) | **Transaction pooler** (Shared / Supavisor) | `aws-<region>.pooler.supabase.com:6543` | **IPv4** (works from Vercel / most home networks) |

Optional on **Pro+**: **Dedicated pooler** (PgBouncer) at `db.<project-ref>.supabase.co:6543` — lower latency, same transaction-mode rules; IPv6 unless you buy the [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address).

Prisma always needs a URL shaped like:

```text
postgresql://USER:PASSWORD@HOST:PORT/postgres?schema=public
```

### Which mode when?

```text
Need migrations / schema tools?
  ├─ Network has IPv6 (or IPv4 add-on) → Direct :5432
  └─ IPv4-only (common on Windows / some ISPs) → Session pooler :5432

Need app / Vercel queries?
  └─ Transaction pooler :6543 + pgbouncer=true
```

Official reference: [Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres).

### Direct (migrations preferred)

Example shape (copy yours from **Connect → Direct**):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?schema=public"
```

Direct connections resolve to **IPv6** unless the project has the IPv4 add-on (the add-on **replaces** IPv6 — it is not dual-stack). If `P1001` / “can't reach database” appears from an IPv4-only network, switch migrations to the **Session pooler** URI instead of buying the add-on.

### Session pooler (migrations on IPv4-only networks)

Shared pooler (**Supavisor**) session mode — port **5432**, username usually `postgres.YOUR_PROJECT_REF`:

```env
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?schema=public"
```

Use this for `db:migrate:deploy` when Direct is unreachable. Prefer Direct when your network supports IPv6.

### Transaction pooler (app / Vercel)

Shared pooler (**Supavisor**) transaction mode — port **6543**. Append `schema=public` and **`pgbouncer=true`** so Prisma disables prepared statements (required in transaction mode):

```env
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?schema=public&pgbouncer=true"
```

Exact username/host text changes in the UI — **copy from Connect**, then only append query params as needed.

> **Note:** `pgbouncer=true` is a Prisma query flag. The shared pooler is Supavisor; dedicated pooler on paid tiers is PgBouncer. Both need prepared statements off in transaction mode.

This project uses a **single** `DATABASE_URL` (see `prisma/schema.prisma`). Swap the value when migrating vs running the app, or keep two URLs in a password manager / CI (`DATABASE_URL_DIRECT` for GitHub Actions migrate — see [vercel.md](vercel.md)). Official Supabase Prisma serverless samples also show a separate `DIRECT_URL`; we have not wired that into the schema yet.

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

Example: password `p@ss` → userinfo `postgres:p%40ss` (or `postgres.REF:p%40ss` on the pooler).

### IPv4 / network

| Situation | What to use |
| --- | --- |
| Local migrations, IPv6 works | Direct `:5432` |
| Local migrations, IPv4-only | Session pooler `:5432` |
| Vercel / serverless runtime | Transaction pooler `:6543` + `pgbouncer=true` |
| Need Direct/Dedicated over IPv4 | [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address) (paid) |

Network restrictions: Dashboard → **Database** settings / network controls. Default projects accept connections; if connect fails, check bans, pause state (free tier), and Observability → Database.

## 4. Apply Prisma migrations

From the repo root, with a **migrate-capable** `DATABASE_URL` (Direct or Session pooler — **not** transaction `:6543`):

```bash
bun install

# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public"
bun run db:migrate:deploy

# macOS / Linux
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public"
bun run db:migrate:deploy
```

Or put the migrate URL into a local `.env` (never commit it):

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?schema=public
```

Then:

```bash
bun run db:migrate:deploy
```

Success looks like Prisma applying migrations under `prisma/migrations/` with no error. Optionally open **Table Editor** and confirm tables (`User`, `Movie`, `UserMovie`, `SyncHistory`, embedding tables, …).

### Dev vs deploy commands

| Command | When |
| --- | --- |
| `bun run db:migrate:deploy` | **Production / Supabase** — applies existing migrations |
| `bun run db:migrate` | Local **dev** only — can create new migration files |

Do **not** use `migrate dev` against a shared production Supabase project.

### Optional: dedicated Prisma DB role

Supabase’s [Prisma guide](https://supabase.com/docs/guides/database/prisma) recommends a custom `prisma` role with `bypassrls` for clearer monitoring. Optional for this API — connecting as `postgres` (or `postgres.<ref>` on the pooler) is enough. If you create a custom role, use that username in both migrate and runtime URLs.

## 5. Point the app at Supabase

### Local development

In `.env`, prefer the **transaction pooler** URL for day-to-day `bun run dev` (same shape as Vercel):

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

1. Set `DATABASE_URL` in Vercel to the **transaction pooler** URI (`:6543`, `schema=public`, `pgbouncer=true`).
2. Keep Direct / Session URLs only on your machine (or as `DATABASE_URL_DIRECT` in CI) for `db:migrate:deploy`.
3. Follow [vercel.md](vercel.md) for the rest of the env vars (`AUTH_*`, optional `OPENAI_API_KEY`, …).
4. Pin Vercel `regions` near the Supabase project region when possible.

On serverless, start with a low Prisma `connection_limit` if you hit pooler client limits (Supabase troubleshooting often suggests `connection_limit=1` as a starting point for serverless). Append as a query param if needed: `&connection_limit=1`.

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

Quick SQL check (**SQL Editor**):

```sql
SELECT COUNT(*) FROM "User";
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

## 7. Security & dashboard extras

Useful, not required by the API:

| Feature | Use |
| --- | --- |
| **Table Editor** | Inspect synced data |
| **SQL Editor** | Ad-hoc checks |
| **Observability → Database** | Connection counts, CPU, I/O |
| **Database → Settings** | Pool size, password reset |
| **API Settings** | Disable Data API if you only use Prisma |
| **Auth / Storage / Edge Functions** | Not used by this API today |

### If the Data API stays enabled

Prisma still uses the DB password over Postgres. Separately, anything granted to `anon` / `authenticated` can be reachable via REST. Prefer:

1. Not granting Data API access to app tables you do not need exposed, **or**
2. Enabling **RLS** on every exposed `public` table and writing policies that match your access model, **or**
3. Disabling the Data API for the project.

Do not put the database password or a `service_role` / secret API key in frontend clients. Publishable / legacy `anon` keys are only relevant if you later adopt `supabase-js` — not required today.

`SUPABASE_URL` and `SUPABASE_KEY` are optional placeholders in env parsing — leaving them unset is fine.

## Checklist

- [ ] Supabase project created; DB password saved
- [ ] `vector` (pgvector) extension enabled
- [ ] Migrate URL works (Direct or Session pooler — not transaction `:6543`)
- [ ] `bun run db:migrate:deploy` completed successfully
- [ ] App / Vercel uses transaction pooler `DATABASE_URL` with `schema=public&pgbouncer=true`
- [ ] `/health` works against that database
- [ ] Test sync writes rows visible in Table Editor
- [ ] (Optional) Data API disabled or tables not publicly granted without RLS

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `P1001: Can't reach database server` | Wrong host/port; IPv6 vs IPv4 — try Session pooler for migrations; check project paused (free tier); verify URI from **Connect** |
| `P1000` / authentication failed | Wrong password; URL-encode special characters; pooler username is often `postgres.<project-ref>` |
| `extension "vector" is not available` | Enable **vector** under Database → Extensions, re-run migrate |
| Migrations OK, Vercel fails to connect | Runtime must use **transaction** pooler `:6543` + `pgbouncer=true` + `schema=public` |
| `prepared statement` / PgBouncer / Supavisor errors | Add `pgbouncer=true` on the transaction URL; never run migrations on `:6543` transaction mode |
| `Timed out fetching a new connection from the connection pool` | Lower Prisma `connection_limit`; raise pool size in Database settings; check Observability for overload |
| `Max client connections reached` | Use transaction mode for serverless; reduce `connection_limit`; upgrade compute / pool size |
| Project paused | Resume in dashboard, then retry |

More Prisma-specific fixes: [Supabase Prisma troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting).

## Related docs

- [Deploy on Vercel](vercel.md)
- [Database overview](database.md)
- [DEVELOPMENT.md](../DEVELOPMENT.md) — full env table
- [architecture.md](architecture.md) — how Prisma is wired
- [Supabase: Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Prisma](https://supabase.com/docs/guides/database/prisma)
- [Supabase: pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
