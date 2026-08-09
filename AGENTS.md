# AGENTS.md

Rules for AI coding agents working in this repository.

## Project

**Letterboxd API** — Bun + Hono + Prisma + PostgreSQL service that syncs Letterboxd data, stores it, and exposes filters/statistics. AI recommendations are a future extension point, not the current scope unless explicitly requested.

Stack: TypeScript, Bun, Hono, Zod, Prisma, Vitest, Pino. Deploy target: Vercel.

## Architecture (non-negotiable)

```
app → features → shared
features depend on ports (interfaces)
infrastructure implements ports
```

| Layer | Path | Role |
| --- | --- | --- |
| App | `src/app/` | HTTP, middleware, DI (`container.ts`), env |
| Features | `src/features/` | Use-cases: service + schemas + types |
| Infrastructure | `src/infrastructure/` | Prisma, Letterboxd scraper, cache, logger |
| Shared | `src/shared/` | Errors, constants, pure utils, shared types |

- Wire new dependencies only in `src/app/container.ts`.
- Do not import infrastructure concretes from features — inject via interfaces.
- Keep Letterboxd HTML parsers isolated from business logic (`infrastructure/letterboxd/parsers.ts`).
- Prefer feature folders shaped as: `types/` → `schemas/` → `service/` → routes in `app/server.ts`.

## Coding standards

- TypeScript strict. No `any`. Prefer discriminated unions and typed errors.
- Errors: use `AppError` / subclasses (`NotFoundError`, `ValidationError`, …) with `code` + `status`.
- Validate input with Zod at API boundaries (`@hono/zod-openapi` schemas).
- Functions: one level of abstraction; extract when branching grows.
- No magic numbers/strings — use `shared/constants` or named env config.
- Logging: Pino at boundaries (HTTP, scraper, sync, DB failures). Do not log secrets.
- External I/O must have timeouts (see `LETTERBOXD_TIMEOUT`, `HttpClient`).

## Letterboxd / scraping

- Unofficial scraper — treat markup as unstable; keep parsers + HTML fixtures.
- Respect `LETTERBOXD_PAGE_DELAY_MS`, pagination caps (`MAX_LIMIT` = 100), and `LETTERBOXD_ENRICH_CONCURRENCY` for on-demand enrichment.
- On scrape failure: mark `SyncHistory` as `FAILED`, log once with context, return typed error.
- Do not commit live scraped dumps with PII beyond test fixtures.

## API & OpenAPI

- New endpoints go through OpenAPI routes in `src/app/server.ts` (schemas, responses, tags).
- Keep docs in sync: `docs/api.md` and Swagger (`/docs`).
- Consistent error JSON: `{ error: { code, message, details?, requestId? } }`.

## Database

- Schema changes only via Prisma (`prisma/schema.prisma` + migrations).
- Prefer upserts keyed by stable IDs (`User.username`, `Movie.slug`).
- Do not bypass repositories for feature logic.

## Cache

- Use `CacheProvider` interface. Default: `MemoryCache`.
- Invalidate user-scoped keys on successful sync (`CACHE_KEYS`).
- Do not hardcode Redis/Upstash — add a new `CacheProvider` impl if needed.

## Testing

- Unit tests next to code (`*.test.ts`) or under `tests/`.
- Parser changes require fixture updates under `tests/fixtures/letterboxd/`.
- API changes: extend `tests/integration/api.test.ts` or add focused service tests.
- Before finishing: `bun run lint && bun run typecheck && bun run test`.

## Versioning (required)

Follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

**Mandatory on every change:** whenever an agent lands code, docs, config, or other project changes, bump the version and document it in the same change set. Do not leave work without a version bump and changelog entry.

| Change type | Bump | Examples |
| --- | --- | --- |
| Breaking API / schema / behavior | `MAJOR` | remove endpoint, change response shape |
| New backward-compatible feature | `MINOR` | new endpoint, optional query param |
| Bug fix, docs, chore, internal refactor, small tweak | `PATCH` | scraper fix, typo, dependency bump, agent rule update (`1.0.0` → `1.0.1`) |

In the same change, update **all** of these:

1. **`package.json`** → `"version"`
2. **OpenAPI** → `info.version` in `src/app/server.ts` (must match `package.json`)
3. **`CHANGELOG.md`** → new section under Keep a Changelog (`Added` / `Changed` / `Fixed` / `Removed`) describing what changed
4. **`docs/`** / **`README.md`** — if the change affects public behavior or setup
5. **`ROADMAP.md`** — only when a roadmap milestone is completed or deferred

Rules:

- Do not leave version strings out of sync across `package.json` and OpenAPI.
- Small / local fixes → always `PATCH` (e.g. `1.0.0` → `1.0.1` → `1.0.2`).
- New compatible capability → `MINOR`; breaking change → `MAJOR`.
- Multiple related edits in one task may share a single bump; do not skip the bump entirely.
- Tag format (when tagging is requested): `vX.Y.Z` matching `package.json`.

## Docs & repo hygiene

- User-facing behavior changes → update `docs/` and `README.md` when relevant.
- Keep versioning artifacts consistent (see **Versioning** above).
- Never commit `.env`, credentials, or secrets. Use `.env.example` only.
- Commits (when asked): Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

## Workflow for agents

1. Read existing patterns in the touched feature before writing code.
2. Prefer smallest change that satisfies the request — no drive-by refactors.
3. Extend via ports (`MovieProvider`, `CacheProvider`, `RecommendationEngine`) instead of condition trees.
4. Do not edit plan files or unrelated docs unless asked.
5. Before finishing: bump `package.json` + OpenAPI `info.version`, and add a `CHANGELOG.md` entry (see **Versioning**).
6. Do not push, force-push, or amend unless the user explicitly requests it.

## Out of scope unless requested

- TMDB enrichment (v2)
- OpenAI / embeddings / RAG (v3)
- Telegram bot / web dashboard (v4)
- Swapping MemoryCache for Redis in production without an explicit task
