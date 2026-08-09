# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.0] - 2026-08-09

### Added

- `supabase/` project (`config.toml` + `supabase/migrations/`) mirrored from Prisma for Supabase GitHub integration / Branching
- `bun run db:sync:supabase` — regenerates `supabase/migrations` from `prisma/migrations` (also runs after `db:migrate`)

### Changed

- Docs: preferred production migrate path for open-source maintainers is Supabase GitHub **Deploy to production** (no GitHub Actions DB secrets); Prisma remains the schema authoring source

## [3.3.3] - 2026-08-09

### Changed

- Supabase docs refreshed for current Connect modes (Direct / Supavisor session & transaction / dedicated PgBouncer), IPv4 vs IPv6, Prisma `pgbouncer=true`, Data API grant rollout notes, and related Vercel/env examples

## [3.3.2] - 2026-08-09

### Added

- User profile responses include `url` — Letterboxd profile link (`https://letterboxd.com/{username}/`)

## [3.3.1] - 2026-08-09

### Changed

- `GET /api/users` items now return the full user profile shape (same as `GET /api/users/:username`)

## [3.3.0] - 2026-08-09

### Added

- `GET /api/users` — paginated list of synced users with search (`q`/`search`), follower/following/movies count filters, and sort

## [3.2.5] - 2026-08-09

### Changed

- Bruno collection nested by API path (`Users/Movies`, `Users/Favorites/Directors`, …); docs updated

## [3.2.4] - 2026-08-09

### Added

- `.env.vercel.example` — minimal production env for the Vercel dashboard
- Scripts: `setup:vercel`, `vercel:dev`, `vercel:env`, `deploy`
- CI: optional production migrate (`DATABASE_URL_DIRECT`) and Vercel deploy (`VERCEL_TOKEN` / org / project ids)
- `postinstall` runs `prisma generate`

### Changed

- `vercel.json` — modern `rewrites` / `functions` (incl. `maxDuration` 60s), `prisma generate` build command
- Prisma client always reused on `globalThis` (warm Vercel invocations)
- [docs/vercel.md](docs/vercel.md) — fast path, region tip, GitHub Actions secrets, Hobby `maxDuration` note

## [3.2.3] - 2026-08-09

### Added

- [docs/supabase.md](docs/supabase.md) — step-by-step Supabase Postgres setup (pgvector, direct vs pooler URLs, migrations)
- [docs/vercel.md](docs/vercel.md) — step-by-step Vercel deploy (env vars, verify, timeouts, troubleshooting)

### Changed

- README / DEVELOPMENT / docs index link to the new deployment guides

## [3.2.2] - 2026-08-09

### Changed

- README slimmed to overview + documentation links; setup, env, scripts, and deployment moved to root [DEVELOPMENT.md](DEVELOPMENT.md)
- `docs/development.md` now points to the root development guide

## [3.2.1] - 2026-08-09

### Changed

- Bruno collection: **Privacy Notice** and **OpenAPI GPT Actions Schema** requests; collection docs for Custom GPT Actions
- Development docs mention the new Bruno helpers

## [3.2.0] - 2026-08-09

### Added

- Curated OpenAPI schema for ChatGPT Custom GPT Actions (`docs/chatgpt-actions.yaml`)
- Public helpers: `GET /openapi-gpt-actions.yaml`, `GET /privacy`
- Setup guide: `docs/chatgpt-actions.md` (linked from README)

### Changed

- Default `AUTH_PUBLIC_PATHS` includes `/privacy` and `/openapi-gpt-actions.yaml` (with `/health`)

## [3.1.1] - 2026-08-09

### Changed

- Bruno collection docs/tests for personalized recommendations (AI when configured)
- README / AGENTS / development notes aligned with shipped OpenAI + pgvector recommendations

## [3.1.0] - 2026-08-09

### Added

- OpenAI integration behind `EmbeddingProvider` / `LlmProvider` ports (`infrastructure/external/openai`)
- pgvector storage for `MovieEmbedding` and `UserTasteEmbedding` with ANN retrieval
- `AiRecommendationEngine` (taste embeddings + optional LLM reasons) with rule-based fallback when the key is missing or AI fails
- Env: `OPENAI_*`, `RECOMMENDATION_ENGINE`, `AI_RECOMMEND_*` (see `.env.example`)
- Optional recommendation fields: `slug`, `movieId`, `year`, `poster`

### Changed

- `GET /api/users/:username/recommendations` uses AI when configured; otherwise unchanged rule-based behavior
- Successful sync invalidates recommendation cache and may refresh embeddings in the background

## [3.0.0] - 2026-08-09

### Removed

- `requestId` field from error JSON responses (use `X-Request-Id` response header for correlation)

## [2.3.1] - 2026-08-09

### Changed

- `.env.example` regrouped with clearer section headers and inline descriptions

## [2.3.0] - 2026-08-09

### Added

- Optional API authentication via env (`AUTH_ENABLED`, `AUTH_METHODS`, `AUTH_TOKENS`, Basic credentials, `AUTH_PUBLIC_PATHS`)
- Supported methods: `api_key` (`X-API-Key`), `bearer` (`Authorization: Bearer`), `basic` (HTTP Basic); multiple methods can be enabled at once
- OpenAPI security schemes registered when auth is enabled

## [2.2.0] - 2026-08-09

### Added

- `q` / `search` query params on `GET /movies` and `GET /favorites` for case-insensitive title/slug contains search
- `POST /api/users/:username/search` — advanced nested filter DSL (`and`/`or` groups, field operators) for flexible library search

## [2.1.0] - 2026-08-09

### Added

- `GET /api/users/:username` now returns `followingCount`, `followersCount`, `externalLinks`, pinned `favoriteFilms`, and `recentLikes` from the Letterboxd profile page (persisted on sync)

### Changed

- Sync stores Letterboxd profile network counts, external links, and profile film snapshots on `User`

## [2.0.1] - 2026-08-09

### Changed

- Bruno collection updated for favorites movie list + directors/genres/years facet requests
- README / development docs mention the Bruno collection and default list `limit` 20

## [2.0.0] - 2026-08-09

### Breaking

- `GET /favorites` now returns a paginated movie list (`items`, `page`, `limit`, `total`, `totalPages`) instead of a combined summary object
- Default list `limit` is **20** (was 50); omitting `limit` still applies the default — unbounded pages are not supported

### Added

- `GET /favorites/directors`, `/favorites/genres`, `/favorites/years` — paginated `{ name, count }` facet lists from the liked set
- Favorite movies support the same filters/sort/pagination as `/movies`

### Changed

- Favorite criteria unchanged: liked flag or rating ≥ 4.5

## [1.5.0] - 2026-08-09

### Added

- `USER_SYNC_TTL_SECONDS` — auto re-sync on user-scoped GET when the last successful sync is older than the TTL (default 12h; `0` disables stale refresh)
- In-flight sync deduplication per username so concurrent GETs share one scrape

### Changed

- User-scoped GET endpoints run freshness check before response cache reads
- Stale auto-sync failures are logged and existing local data is returned

## [1.4.1] - 2026-08-09

### Changed

- On-demand enrichment default concurrency raised to 8 with per-film retries (`LETTERBOXD_ENRICH_RETRIES`)
- HTTP scraper retries use full-jitter exponential backoff
- Sync fetches movies list and diary in parallel after profile check

## [1.4.0] - 2026-08-09

### Added

- Internal `Movie.enriched` flag (not exposed in API) to track film-page metadata enrichment
- On-demand enrichment: genres/director/poster are fetched only for movies included in an API response
- `LETTERBOXD_ENRICH_CONCURRENCY` for parallel on-demand enrichment

### Changed

- Sync no longer enriches film pages; it only imports list + diary data
- Movie list `limit` hard-capped at 100 (Zod + repository clamp)

### Removed

- `LETTERBOXD_ENRICH_MAX` progressive sync enrichment cap

## [1.3.1] - 2026-08-09

### Fixed

- Bun.serve `idleTimeout` raised to 255s so sync/enrichment requests are not killed at the default 10s

## [1.3.0] - 2026-08-09

### Added

- Letterboxd film-page metadata enrichment (JSON-LD): genres, director, real poster URLs, with progressive cap `LETTERBOXD_ENRICH_MAX`
- Poster JSON fallback via `/film/{slug}/poster/std/150/`
- Diary scrape merge for `watchedDate` (best-effort; sync continues if diary fails)
- `url` field on movie responses pointing to the Letterboxd film page

### Fixed

- Year parsed from list titles like `Crash (1996)` when release-year attributes are missing
- SPA placeholder posters (`empty-poster`) no longer stored as real poster URLs
- Re-sync no longer overwrites enriched movie fields with empty list data

## [1.2.0] - 2026-08-09

### Changed

- Unified movie objects across endpoints: `/movies`, `/favorites` (`favoriteMovies`), and `/ratings` (`bestMovies` / `worstMovies`) now all return the full `MovieDto` (`id`, `title`, `year`, `slug`, `poster`, `genres`, `director`, `rating`, `favorite`, `watchedDate`)

## [1.1.1] - 2026-08-09

### Changed

- Renamed project branding from Letterboxd Intelligence API to Letterboxd API (`package` name, health `service`, OpenAPI title, Bruno collection, User-Agent)

## [1.1.0] - 2026-08-09

### Added

- Lazy Letterboxd sync on all user-scoped GET endpoints (movies, ratings, favorites, statistics, recommendations) when the user is missing locally — same behavior as the profile endpoint

## [1.0.2] - 2026-08-09

### Fixed

- Letterboxd scrape HTTP 403 from Cloudflare by sending navigation-like headers (`Sec-Fetch-*`, `Accept-Language`) and retrying challenge responses

## [1.0.1] - 2026-08-09

### Changed

- Require agents to bump SemVer and update `CHANGELOG.md` on every change (`AGENTS.md`)

## [1.0.0] - 2026-08-06

### Added

- Initial Letterboxd API (v1)
- Letterboxd scraper provider (`MovieProvider`)
- Prisma schema: User, Movie, UserMovie, SyncHistory
- REST endpoints: profile, movies, ratings, favorites, statistics, sync, recommendations
- Memory cache + Redis-ready interface
- OpenAPI / Swagger UI at `/docs`
- Vitest unit and API integration tests
- GitHub Actions CI
- Documentation under `docs/`
