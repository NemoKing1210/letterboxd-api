# Contributing

Thanks for contributing to Letterboxd API.

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Production-ready releases |
| `develop` | Integration branch |
| `feature/*` | New features |
| `fix/*` | Bug fixes |

## Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add movies year filter
fix: handle empty Letterboxd films page
docs: update architecture diagram
refactor: extract cache invalidation helper
test: cover ratings distribution
chore: bump prisma
```

## Workflow

1. Fork / branch from `develop`
2. Install: `bun install`
3. Start Postgres: `docker compose up -d`
4. Migrate: `bun run db:migrate`
5. Make changes with tests
6. Run `bun run lint && bun run test && bun run typecheck`
7. Open a PR into `develop`

## Code guidelines

- Keep feature modules cohesive: types → schemas → service → routes
- Depend on interfaces at boundaries (`MovieProvider`, `CacheProvider`, repositories)
- No `any` — use typed errors (`AppError` subclasses)
- Prefer small pure helpers in `shared/utils`
- Scraper parsers stay isolated from business logic

## Pull requests

- Describe *why* the change exists
- Link related issues
- Include test plan checklist
- Keep PRs focused

## Security / scraping

Do not add aggressive scraping (no parallel floods). Keep delays and timeouts. Never commit secrets.
