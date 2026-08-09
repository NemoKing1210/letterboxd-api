# Development

Local setup, environment, scripts, and contributor workflow for Letterboxd API.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- Docker (for local Postgres) or a Supabase / managed Postgres project

## Setup

### 1. Install

```bash
bun install
cp .env.example .env
```

### 2. Start database

```bash
docker compose up -d
bun run db:generate
bun run db:migrate
```

Or configure discrete DB vars in `.env` for OpenServer:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=letterboxd
DB_SCHEMA=public
```

Alternatively set a full `DATABASE_URL` (Supabase / managed Postgres) — it overrides `DB_*`.

### 3. Run API

```bash
bun run dev
```

- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/docs`

## Environment

| Variable | Description |
| --- | --- |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_SCHEMA` | Discrete PostgreSQL settings (OpenServer-friendly) |
| `DATABASE_URL` | Optional full URL; if set, overrides `DB_*` |
| `SUPABASE_URL` / `SUPABASE_KEY` | Optional Supabase credentials |
| `HTTPS_PROXY` / `HTTP_PROXY` | Optional outbound proxy URL (`http://user:pass@host:port`) for Letterboxd and other external HTTP |
| `NO_PROXY` | Comma-separated hosts that bypass the proxy |
| `LETTERBOXD_TIMEOUT` | Scraper HTTP timeout (ms) |
| `LETTERBOXD_PAGE_DELAY_MS` | Delay between scrape list pages |
| `LETTERBOXD_MAX_PAGES` | Max pages per list scrape |
| `LETTERBOXD_ENRICH_CONCURRENCY` | Parallel on-demand film-page enrichments when serving responses (default 8) |
| `LETTERBOXD_ENRICH_RETRIES` | Retries per film during on-demand enrichment (default 3) |
| `CACHE_TTL` | In-memory cache TTL (seconds) |
| `USER_SYNC_TTL_SECONDS` | Re-sync on user GET when last successful sync is older (default 43200 = 12h; `0` = only when user missing) |
| `RATE_LIMIT_*` | Per-IP rate limiting |
| `CORS_ORIGIN` | Allowed origins (`*` or CSV) |
| `AUTH_ENABLED` | Enable API auth (`true`/`false`, default `false`) |
| `AUTH_METHODS` | CSV: `api_key`, `bearer`, `basic` (default `api_key,bearer`) |
| `AUTH_TOKENS` | CSV secrets for `api_key` / `bearer` (required when those methods are enabled) |
| `AUTH_BASIC_USERNAME` / `AUTH_BASIC_PASSWORD` | HTTP Basic credentials (required when `basic` is enabled) |
| `AUTH_PUBLIC_PATHS` | CSV exact paths that skip auth (default `/health,/privacy,/openapi-gpt-actions.yaml`) |

Full reference: [`.env.example`](.env.example). Auth details: [docs/api.md](docs/api.md#authentication).

### Making the API private

Set `AUTH_ENABLED=true` and provide secrets. Any enabled method may be used:

```bash
# API key
curl -H "X-API-Key: YOUR_TOKEN" "http://localhost:3000/api/users/USERNAME/movies"

# Bearer
curl -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:3000/api/users/USERNAME/movies"

# Basic (when AUTH_METHODS includes basic)
curl -u USER:PASS "http://localhost:3000/api/users/USERNAME/movies"
```

Do not pass tokens in query strings (they leak into logs and proxies).

## Scripts

```bash
bun run dev           # hot reload
bun run test          # vitest
bun run lint          # eslint
bun run typecheck     # tsc --noEmit
bun run format        # prettier
bun run format:check  # prettier check
bun run build         # bun build
bun run db:studio     # prisma studio
```

## Quality checks

```bash
bun run lint
bun run typecheck
bun run test
bun run format:check
```

## Project layout

```
src/app             HTTP, DI, config, middleware
src/features        domain use-cases by feature
src/infrastructure  Prisma, Letterboxd scraper, cache, logger
src/shared          errors, utils, constants, types
tests/fixtures      HTML fixtures for scraper
tests/integration   API tests with mocked services
```

Import rule: `app → features → shared`; infrastructure implements ports used by features. See [docs/architecture.md](docs/architecture.md).

## Adding a feature

1. Define types + Zod schemas
2. Add service with injected ports
3. Wire in `app/container.ts`
4. Register OpenAPI route in `app/server.ts`
5. Add unit tests

## Git workflow

Branches: `main`, `develop`, `feature/*`, `fix/*`.

Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

Husky runs lint-staged on pre-commit. Full conventions: [CONTRIBUTING.md](CONTRIBUTING.md).

## Local scraping tips

- Prefer `POST /sync` intentionally; avoid hammering Letterboxd
- Use fixtures under `tests/fixtures/letterboxd` for parser changes
- Keep `LETTERBOXD_PAGE_DELAY_MS` ≥ 500 for real scrapes
- On-demand enrichment uses `LETTERBOXD_ENRICH_CONCURRENCY` (default 8) and `LETTERBOXD_ENRICH_RETRIES` (default 3); only movies in the response are enriched and then flagged `Movie.enriched`
- Transient Letterboxd/HTTP failures use full-jitter backoff at both HTTP and enrichment layers
- List endpoints default `limit` to 20 (max 100); omitting `limit` still applies the default
- Local Bun server uses `idleTimeout: 255` because first-page enrichment can exceed the default 10s request timeout
- Scraper `HttpClient` sends navigation-like headers so Cloudflare is less likely to challenge requests; challenges are retried with backoff
- Optional outbound proxy: set `HTTPS_PROXY` / `HTTP_PROXY` (and `NO_PROXY` if needed). Applies only to external HTTP (Letterboxd scrape, future APIs) — not to PostgreSQL/Prisma

## Bruno

Open the [`bruno/`](bruno/) folder in [Bruno](https://www.usebruno.com/). Select the **Local** environment, set `username`, then run **Sync User** (or **Get User Profile** for lazy sync) before hitting derived endpoints.

**Get Recommendations** uses OpenAI when the API process has `OPENAI_API_KEY` and Postgres has pgvector (`bun run db:migrate`). Without a key it returns the rule-based fallback — no Bruno env vars are required for OpenAI (keys stay in server `.env`).

Under **Health & public helpers**:

- **Privacy Notice** — `GET /privacy`
- **OpenAPI GPT Actions Schema** — `GET /openapi-gpt-actions.yaml`

These stay public when auth is enabled (default `AUTH_PUBLIC_PATHS`). Full Custom GPT setup: [docs/chatgpt-actions.md](docs/chatgpt-actions.md).

## Deployment

Step-by-step production guides:

1. **[docs/supabase.md](docs/supabase.md)** — create the project, enable pgvector, get connection strings, run migrations
2. **[docs/vercel.md](docs/vercel.md)** — import the repo, set env vars, deploy, verify

Entrypoint on Vercel: [`api/index.ts`](api/index.ts) (see [`vercel.json`](vercel.json)).
