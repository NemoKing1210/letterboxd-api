# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-08-09

### Changed

- Require agents to bump SemVer and update `CHANGELOG.md` on every change (`AGENTS.md`)

## [1.0.0] - 2026-08-06

### Added

- Initial Letterboxd Intelligence API (v1)
- Letterboxd scraper provider (`MovieProvider`)
- Prisma schema: User, Movie, UserMovie, SyncHistory
- REST endpoints: profile, movies, ratings, favorites, statistics, sync, recommendations
- Memory cache + Redis-ready interface
- OpenAPI / Swagger UI at `/docs`
- Vitest unit and API integration tests
- GitHub Actions CI
- Documentation under `docs/`
