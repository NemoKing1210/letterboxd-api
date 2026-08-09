# Letterboxd API

Production-ready API for analyzing Letterboxd film taste: sync user data, filter movies, compute statistics, and prepare for AI recommendations.

> **Disclaimer:** Letterboxd does not provide a public API. This project uses an unofficial HTML scraper for personal/educational use. Respect Letterboxd Terms of Service and rate limits. Scrapers may break when Letterboxd changes markup.

## Features (v1)

- Sync Letterboxd profiles into PostgreSQL
- User profile aggregates
- Movies API with rating / year / genre / director filters, title search (`q`/`search`), sorting, pagination
- Advanced `POST /search` filter DSL for nested queries
- Ratings, favorites, and statistics endpoints
- Rule-based recommendation stub (AI-ready interface)
- OpenAPI + Swagger UI at `/docs`
- Clean Architecture + feature modules
- Memory cache with Redis-ready interface
- Vitest, ESLint, Prettier, Husky, GitHub Actions

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun |
| HTTP | Hono + Zod OpenAPI |
| Database | PostgreSQL (Supabase-compatible) |
| ORM | Prisma |
| Validation | Zod |
| Logging | Pino |
| Deploy | Vercel Serverless |
| Tests | Vitest |

## Architecture

```
src/
  app/            # HTTP, DI, config, middleware
  features/       # domain use-cases by feature
  infrastructure/ # Prisma, Letterboxd scraper, cache, logger
  shared/         # errors, utils, constants, types
```

Import rule: `app → features → shared`; infrastructure implements ports used by features.

See [docs/architecture.md](docs/architecture.md).

## Quick start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- Docker (for local Postgres) or a Supabase project

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
| `AUTH_PUBLIC_PATHS` | CSV exact paths that skip auth (default `/health`) |

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

## API overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/users/:username` | Profile (aggregates + Letterboxd network/links/pinned films) |
| `GET` | `/api/users/:username/movies` | Filtered movie list |
| `GET` | `/api/users/:username/ratings` | Ratings summary |
| `GET` | `/api/users/:username/favorites` | Favorite movies (filtered, paginated) |
| `GET` | `/api/users/:username/favorites/directors` | Favorite directors |
| `GET` | `/api/users/:username/favorites/genres` | Favorite genres |
| `GET` | `/api/users/:username/favorites/years` | Favorite years |
| `POST` | `/api/users/:username/search` | Advanced nested filter search |
| `GET` | `/api/users/:username/statistics` | Statistics |
| `GET` | `/api/users/:username/recommendations` | Rule-based recommendations |
| `POST` | `/api/users/:username/sync` | Force Letterboxd sync |

User-scoped `GET` endpoints auto-sync from Letterboxd when the user is missing locally, or when the last successful sync is older than `USER_SYNC_TTL_SECONDS` (default 12h; set `0` to disable stale refresh). First sync / refresh may be slow. Sync imports the films list (year from titles, no placeholder posters) and diary watched dates. Genres, directors, and real posters are enriched on demand for movies returned by the API (tracked by internal `Movie.enriched`). List endpoints default `limit` to 20 (max 100); omitting `limit` still caps the page size. Movie responses include a Letterboxd `url`.

Example:

```bash
curl "http://localhost:3000/api/users/USERNAME/movies?ratingMin=4&sort=rating_desc&limit=20"
curl "http://localhost:3000/api/users/USERNAME/favorites/directors?limit=10"
curl -X POST http://localhost:3000/api/users/USERNAME/sync
```

## Scripts

```bash
bun run dev           # hot reload
bun run test          # vitest
bun run lint          # eslint
bun run format        # prettier
bun run build         # bun build
bun run db:studio     # prisma studio
```

## Deployment (Vercel)

1. Create a Vercel project linked to this repo
2. Set DB env vars (`DB_*` or `DATABASE_URL`) and other secrets in Vercel
3. Deploy — entrypoint is [`api/index.ts`](api/index.ts)

## Documentation

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Database](docs/database.md)
- [Development](docs/development.md)
- [Roadmap](docs/roadmap.md)
- Bruno collection: open the [`bruno/`](bruno/) folder in [Bruno](https://www.usebruno.com/) (Local env → set `username`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
