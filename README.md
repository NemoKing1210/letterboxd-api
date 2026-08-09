# Letterboxd API

Production-ready API for analyzing Letterboxd film taste: sync user data, filter movies, compute statistics, and personalized AI recommendations (when OpenAI is configured).

> **Disclaimer:** Letterboxd does not provide a public API. This project uses an unofficial HTML scraper for personal/educational use. Respect Letterboxd Terms of Service and rate limits. Scrapers may break when Letterboxd changes markup.

## Features

- Sync Letterboxd profiles into PostgreSQL
- User profile aggregates
- Movies API with rating / year / genre / director filters, title search, sorting, pagination
- Advanced `POST /search` filter DSL for nested queries
- Ratings, favorites, and statistics endpoints
- Personalized recommendations (OpenAI embeddings + pgvector when configured; rule-based fallback)
- OpenAPI + Swagger UI at `/docs`
- Clean Architecture + feature modules
- Memory cache with Redis-ready interface
- Vitest, ESLint, Prettier, Husky, GitHub Actions

## Stack

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Runtime    | Bun                              |
| HTTP       | Hono + Zod OpenAPI               |
| Database   | PostgreSQL (Supabase-compatible) |
| ORM        | Prisma                           |
| Validation | Zod                              |
| Logging    | Pino                             |
| Deploy     | Vercel Serverless                |
| Tests      | Vitest                           |

## Quick start

```bash
bun install
cp .env.example .env
docker compose up -d
bun run db:generate && bun run db:migrate
bun run dev
```

- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/docs`

Full local setup: **[DEVELOPMENT.md](DEVELOPMENT.md)**. Production: **[Supabase](docs/supabase.md)** → **[Vercel](docs/vercel.md)**.

## Documentation

| Document                                           | Description                                                   |
| -------------------------------------------------- | ------------------------------------------------------------- |
| [DEVELOPMENT.md](DEVELOPMENT.md)                   | Local setup, env, scripts, Bruno                              |
| [docs/supabase.md](docs/supabase.md)               | Supabase Postgres: Connect modes, pgvector, GitHub migrations |
| [docs/vercel.md](docs/vercel.md)                   | Deploy on Vercel (fast path, CI, env)                         |
| [docs/architecture.md](docs/architecture.md)       | Layers, sync flow, extension points                           |
| [docs/api.md](docs/api.md)                         | REST endpoints, query params, errors                          |
| [docs/database.md](docs/database.md)               | Prisma models, ER diagram, migrations                         |
| [docs/chatgpt-actions.md](docs/chatgpt-actions.md) | ChatGPT Custom GPT Actions                                    |
| [docs/roadmap.md](docs/roadmap.md)                 | Product roadmap (v1–v4)                                       |
| [CONTRIBUTING.md](CONTRIBUTING.md)                 | Branches, commits, PR workflow                                |
| [CHANGELOG.md](CHANGELOG.md)                       | Release history                                               |
| [docs/](docs/README.md)                            | Full documentation index                                      |

Bruno collection: open [`bruno/`](bruno/) in [Bruno](https://www.usebruno.com/) (see [DEVELOPMENT.md](DEVELOPMENT.md#bruno)).

## License

[MIT](LICENSE)
