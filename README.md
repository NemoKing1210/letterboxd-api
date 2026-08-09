# Letterboxd API

Production-ready API for analyzing Letterboxd film taste: sync user data, filter movies, compute statistics, and prepare for AI recommendations.

> **Disclaimer:** Letterboxd does not provide a public API. This project uses an unofficial HTML scraper for personal/educational use. Respect Letterboxd Terms of Service and rate limits. Scrapers may break when Letterboxd changes markup.

## Features (v1)

- Sync Letterboxd profiles into PostgreSQL
- User profile aggregates
- Movies API with rating / year / genre / director filters, sorting, pagination
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
| `LETTERBOXD_PAGE_DELAY_MS` | Delay between scrape pages |
| `LETTERBOXD_MAX_PAGES` | Max pages per list scrape |
| `CACHE_TTL` | In-memory cache TTL (seconds) |
| `RATE_LIMIT_*` | Per-IP rate limiting |
| `CORS_ORIGIN` | Allowed origins (`*` or CSV) |

## API overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/users/:username` | Profile |
| `GET` | `/api/users/:username/movies` | Filtered movie list |
| `GET` | `/api/users/:username/ratings` | Ratings summary |
| `GET` | `/api/users/:username/favorites` | Favorites summary |
| `GET` | `/api/users/:username/statistics` | Statistics |
| `GET` | `/api/users/:username/recommendations` | Rule-based recommendations |
| `POST` | `/api/users/:username/sync` | Force Letterboxd sync |

User-scoped `GET` endpoints auto-sync from Letterboxd when the user is missing locally (first request may be slow).

Example:

```bash
curl "http://localhost:3000/api/users/USERNAME/movies?ratingMin=4&sort=rating_desc&limit=20"
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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
