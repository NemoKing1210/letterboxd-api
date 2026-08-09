# API

Interactive docs: `GET /docs` (Swagger UI). Spec: `GET /openapi.json`.

## Authentication

By default the API is open (`AUTH_ENABLED=false`). When `AUTH_ENABLED=true`, every path except those listed in `AUTH_PUBLIC_PATHS` (default: `/health,/privacy,/openapi-gpt-actions.yaml`) requires credentials.

Configure methods with `AUTH_METHODS` (CSV). Any listed method may succeed:

| Method    | How to send                                                                     |
| --------- | ------------------------------------------------------------------------------- |
| `api_key` | Header `X-API-Key: <token>` — tokens from `AUTH_TOKENS`                         |
| `bearer`  | Header `Authorization: Bearer <token>` — same `AUTH_TOKENS`                     |
| `basic`   | Header `Authorization: Basic …` — `AUTH_BASIC_USERNAME` / `AUTH_BASIC_PASSWORD` |

Failed auth returns `401` with `{ "error": { "code": "UNAUTHORIZED", ... } }` and may include `WWW-Authenticate` for bearer/basic. Query-string API keys are not supported.

When auth is enabled, OpenAPI advertises the active security schemes at `/openapi.json`.

## Endpoints

### Health

`GET /health`

```json
{ "status": "ok", "service": "letterboxd-api", "timestamp": "..." }
```

### ChatGPT Actions helpers

Public by default (included in `AUTH_PUBLIC_PATHS`):

| Path                            | Description                                         |
| ------------------------------- | --------------------------------------------------- |
| `GET /privacy`                  | Short HTML privacy notice (GPT Builder privacy URL) |
| `GET /openapi-gpt-actions.yaml` | Curated OpenAPI schema for Custom GPT Actions       |

Setup guide: [chatgpt-actions.md](chatgpt-actions.md). Repo copy of the schema: [`chatgpt-actions.yaml`](chatgpt-actions.yaml).

### Lazy sync

All user-scoped `GET` endpoints below auto-sync from Letterboxd when the username is not in the local database yet, or when the last successful sync is older than `USER_SYNC_TTL_SECONDS` (default 12 hours; `0` disables stale refresh only). The first request / refresh may take longer (full scrape). If a stale refresh fails, the API serves existing local data. Use `POST .../sync` to force a refresh.

### Synced users

`GET /api/users`

Lists users already stored locally (after at least one sync). Does **not** trigger Letterboxd sync.

Query params:

| Param                           | Description                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `followersMin` / `followersMax` | Followers count range                                                                                                                                                                            |
| `followingMin` / `followingMax` | Following count range                                                                                                                                                                            |
| `moviesMin` / `moviesMax`       | Diary size (synced movies) range                                                                                                                                                                 |
| `q` / `search`                  | Case-insensitive username contains (aliases; must be identical if both are set)                                                                                                                  |
| `sort`                          | `username_asc`, `username_desc`, `created_desc`, `created_asc`, `updated_desc`, `updated_asc`, `followers_desc`, `followers_asc`, `following_desc`, `following_asc`, `movies_desc`, `movies_asc` |
| `page` / `limit`                | Pagination (`limit` default **20**, max **100**)                                                                                                                                                 |

```json
{
  "items": [
    {
      "username": "example",
      "url": "https://letterboxd.com/example/",
      "moviesCount": 500,
      "averageRating": 4.2,
      "favoriteGenres": [{ "name": "sci-fi", "count": 42 }],
      "lastSyncedAt": "2026-08-06T12:00:00.000Z",
      "followingCount": 1,
      "followersCount": 2,
      "externalLinks": [{ "label": "linktr.ee", "url": "https://linktr.ee/example" }],
      "favoriteFilms": [
        {
          "slug": "inception",
          "title": "Inception",
          "year": 2010,
          "poster": "https://...",
          "url": "https://letterboxd.com/film/inception/"
        }
      ],
      "recentLikes": []
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

Each `items[]` entry uses the same shape as `GET /api/users/:username`.

### User profile

`GET /api/users/:username`

```json
{
  "username": "example",
  "url": "https://letterboxd.com/example/",
  "moviesCount": 500,
  "averageRating": 4.2,
  "favoriteGenres": [{ "name": "sci-fi", "count": 42 }],
  "lastSyncedAt": "2026-08-06T12:00:00.000Z",
  "followingCount": 1,
  "followersCount": 2,
  "externalLinks": [{ "label": "linktr.ee", "url": "https://linktr.ee/example" }],
  "favoriteFilms": [
    {
      "slug": "inception",
      "title": "Inception",
      "year": 2010,
      "poster": "https://...",
      "url": "https://letterboxd.com/film/inception/"
    }
  ],
  "recentLikes": []
}
```

Pinned `favoriteFilms` and `recentLikes` come from the Letterboxd profile page (synced snapshot). They are separate from `GET /favorites` (liked films / high ratings).

### Movie object

Wherever the API returns a film (list item or nested in summaries), it uses the same shape:

```json
{
  "id": "clx...",
  "title": "Arrival",
  "year": 2016,
  "slug": "arrival",
  "url": "https://letterboxd.com/film/arrival/",
  "poster": "https://...",
  "genres": ["sci-fi", "drama"],
  "director": "Denis Villeneuve",
  "rating": 4.5,
  "favorite": true,
  "watchedDate": "2024-06-01T12:00:00.000Z"
}
```

Used by: `/movies` (`items`), `/ratings` (`bestMovies` / `worstMovies`), `/favorites` (`items`).

### Movies

`GET /api/users/:username/movies`

Query params:

| Param                     | Description                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `ratingMin` / `ratingMax` | 0–5                                                                                        |
| `year`                    | Exact year                                                                                 |
| `yearFrom` / `yearTo`     | Range                                                                                      |
| `genre`                   | Exact genre token (lowercase; filled by Letterboxd film-page enrichment)                   |
| `director`                | Case-insensitive contains                                                                  |
| `q` / `search`            | Case-insensitive title or slug contains (aliases; must be identical if both are set)       |
| `sort`                    | `rating_desc`, `rating_asc`, `date_desc`, `date_asc`, `year_desc`, `year_asc`, `title_asc` |
| `page` / `limit`          | Pagination (`limit` default **20**, max **100**)                                           |

Paginated response: `{ items: Movie[], page, limit, total, totalPages }`. Omitting `limit` still applies the default of 20 — unbounded lists are not supported.

### Advanced search

`POST /api/users/:username/search`

JSON body with optional nested `filter`, plus `sort` / `page` / `limit` (same defaults as `/movies`).

```json
{
  "filter": {
    "op": "and",
    "conditions": [
      { "field": "title", "op": "contains", "value": "matrix" },
      { "field": "year", "op": "gte", "value": 1990 },
      {
        "op": "or",
        "conditions": [
          { "field": "genre", "op": "eq", "value": "sci-fi" },
          { "field": "director", "op": "contains", "value": "Wachowski" }
        ]
      }
    ]
  },
  "sort": "rating_desc",
  "page": 1,
  "limit": 20
}
```

- **Groups:** `{ "op": "and"|"or", "conditions": [...] }` (max depth 5, max 32 conditions per group)
- **Atoms:** `{ "field", "op", "value", "valueTo"? }` (`valueTo` for `between`; array `value` for `in`)
- **Fields:** `title`, `slug`, `director`, `genre`, `year`, `rating`, `favorite`, `watchedDate`
- **Operators:** strings — `eq`, `neq`, `contains`, `startsWith`, `endsWith`, `in`; genre — `eq`, `in`; numbers — `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`; `favorite` — `eq`; `watchedDate` — `eq`, `gte`, `lte`, `between` (ISO datetimes)
- Omit `filter` to return the full library (paginated)

Response: same paginated `Movie[]` shape as `/movies`.

### Ratings

`GET /api/users/:username/ratings`

Returns average, count, best/worst films (full `Movie` objects), rating distribution.

### Favorites

`GET /api/users/:username/favorites`

Paginated favorite movies (liked flag or rating ≥ 4.5). Same query filters/sort/pagination as `/movies` (`limit` default **20**, max **100**).

Response: `{ items: Movie[], page, limit, total, totalPages }`.

Facet lists (same pagination; sorted by `count` desc, then `name` asc):

| Path                                           | Description                                                    |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `GET /api/users/:username/favorites/directors` | `{ items: [{ name, count }], page, limit, total, totalPages }` |
| `GET /api/users/:username/favorites/genres`    | same shape                                                     |
| `GET /api/users/:username/favorites/years`     | same shape                                                     |

### Statistics

`GET /api/users/:username/statistics`

```json
{
  "moviesWatched": 500,
  "averageRating": 4.4,
  "topGenres": [],
  "topDirectors": [],
  "topDecades": []
}
```

### Sync

`POST /api/users/:username/sync`

Forces a Letterboxd list + diary scrape and upserts local rows. Film genres/directors/posters are **not** filled during sync — they are enriched on demand when those movies appear in API responses. Diary dates are best-effort.

### Recommendations

`GET /api/users/:username/recommendations?limit=5`

Personalized recommendations when `OPENAI_API_KEY` is set (taste embeddings + pgvector ANN, optional LLM reasons). Without a key (or on AI failure), falls back to the rule-based engine.

Response items may include optional `slug`, `movieId`, `year`, and `poster` when the AI path returns catalog films.

## Errors

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User \"x\" not found"
  }
}
```

Correlation id is returned in the `X-Request-Id` response header (not in the JSON body).

Common codes: `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `EXTERNAL_SERVICE_ERROR`, `SYNC_FAILED`, `INTERNAL_ERROR`.
