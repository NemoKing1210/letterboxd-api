# Database

PostgreSQL via Prisma. Configure either discrete `DB_*` variables or a full `DATABASE_URL` (Supabase / managed). If both are set, `DATABASE_URL` wins.

## ER diagram

```mermaid
erDiagram
  User ||--o{ UserMovie : watches
  Movie ||--o{ UserMovie : appears_in
  User ||--o{ SyncHistory : has

  User {
    string id PK
    string username UK
    datetime createdAt
    datetime updatedAt
  }

  Movie {
    string id PK
    string title
    int year
    int tmdbId
    string poster
    string[] genres
    string director
    string slug UK
  }

  UserMovie {
    string id PK
    string userId FK
    string movieId FK
    float rating
    boolean favorite
    datetime watchedDate
  }

  SyncHistory {
    string id PK
    string userId FK
    string username
    enum status
    datetime startedAt
    datetime finishedAt
    string error
  }
```

## Models

- **User** — Letterboxd username identity
- **Movie** — canonical film keyed by Letterboxd `slug` (TMDB id reserved for v2)
- **UserMovie** — watch relationship with rating / favorite / date
- **SyncHistory** — audit trail for scrape jobs (`PENDING|RUNNING|SUCCESS|FAILED`)

## Migrations

```bash
bun run db:migrate          # dev
bun run db:migrate:deploy   # prod / CI
bun run db:studio           # GUI
```

Initial migration lives in `prisma/migrations/`.
