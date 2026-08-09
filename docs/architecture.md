# Architecture

## Overview

Letterboxd API follows Clean Architecture with feature modules and a thin HTTP layer.

```mermaid
flowchart TB
  Client[HTTP Client] --> Routes[Hono OpenAPI Routes]
  Routes --> Services[Feature Services]
  Services --> Repos[Repository Ports]
  Services --> Provider[MovieProvider]
  Services --> Cache[CacheProvider]
  Repos --> Prisma[Prisma PostgreSQL]
  Provider --> Scraper[LetterboxdScraperProvider]
  Scraper --> LB[Letterboxd HTML]
```

## Layers

| Layer | Responsibility |
| --- | --- |
| `app/` | Composition root, middleware, routing, env |
| `features/` | Use-cases: users, movies, ratings, sync, etc. |
| `infrastructure/` | Prisma, scraper, cache, logger, future external APIs |
| `shared/` | Errors, constants, pure utils, shared types |

## Dependency rule

- Features depend on **ports** (interfaces), not concrete adapters
- Adapters live in `infrastructure/` and are wired in `app/container.ts`
- No feature imports another feature's internals except shared contracts (schemas reused carefully)

## Synchronization sequence

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant Sync as SynchronizationService
  participant LB as MovieProvider
  participant DB as Repositories
  participant Cache

  Client->>API: GET /api/users/:username/... (user missing locally)
  API->>Sync: syncLetterboxdUser (lazy)
  Sync->>DB: create SyncHistory RUNNING
  Sync->>LB: getProfile + getMovies
  LB-->>Sync: films
  Sync->>DB: upsert User / Movie / UserMovie
  Sync->>DB: update SyncHistory SUCCESS
  Sync->>Cache: invalidate user keys
  Sync-->>API: SyncResponse
  API-->>Client: 200 JSON (requested resource)

  Note over Client,Cache: POST /api/users/:username/sync forces the same scrape cycle explicitly
```

## Extension points

| Port | Current impl | Future |
| --- | --- | --- |
| `MovieProvider` | `LetterboxdScraperProvider` | Official API if ever available |
| `CacheProvider` | `MemoryCache` | Redis / Upstash / Vercel KV |
| `RecommendationEngine` | `RuleBasedRecommendationEngine` | OpenAI + pgvector RAG |

## Serverless notes

- Prisma client is cached on `globalThis` to survive warm Vercel invocations
- Composition root is lazy via `getContainer()`
- Rate limiting is in-memory (per instance); swap to Redis for multi-instance accuracy
