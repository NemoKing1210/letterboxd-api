# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
