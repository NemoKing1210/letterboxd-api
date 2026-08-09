# Development

## Setup

```bash
bun install
cp .env.example .env
docker compose up -d
bun run db:generate
bun run db:migrate
bun run dev
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
src/app          HTTP + DI
src/features     domain features
src/infrastructure  adapters
src/shared       cross-cutting
tests/fixtures   HTML fixtures for scraper
tests/integration API tests with mocked services
```

## Adding a feature

1. Define types + Zod schemas
2. Add service with injected ports
3. Wire in `app/container.ts`
4. Register OpenAPI route in `app/server.ts`
5. Add unit tests

## Git workflow

Branches: `main`, `develop`, `feature/*`, `fix/*`.

Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

Husky runs lint-staged on pre-commit.

## Local scraping tips

- Prefer `POST /sync` intentionally; avoid hammering Letterboxd
- Use fixtures under `tests/fixtures/letterboxd` for parser changes
- Keep `LETTERBOXD_PAGE_DELAY_MS` ≥ 500 for real scrapes
- On-demand enrichment uses `LETTERBOXD_ENRICH_CONCURRENCY` (default 4); only movies in the response are enriched and then flagged `Movie.enriched`
- Movie list `limit` cannot exceed 100
- Local Bun server uses `idleTimeout: 255` because first-page enrichment can exceed the default 10s request timeout
- Scraper `HttpClient` sends navigation-like headers so Cloudflare is less likely to challenge requests; challenges are retried with backoff
- Optional outbound proxy: set `HTTPS_PROXY` / `HTTP_PROXY` (and `NO_PROXY` if needed). Applies only to external HTTP (Letterboxd scrape, future APIs) — not to PostgreSQL/Prisma.
