# API

Interactive docs: `GET /docs` (Swagger UI). Spec: `GET /openapi.json`.

## Endpoints

### Health

`GET /health`

```json
{ "status": "ok", "service": "letterboxd-api", "timestamp": "..." }
```

### Lazy sync

All user-scoped `GET` endpoints below auto-sync from Letterboxd when the username is not in the local database yet, or when the last successful sync is older than `USER_SYNC_TTL_SECONDS` (default 12 hours; `0` disables stale refresh only). The first request / refresh may take longer (full scrape). If a stale refresh fails, the API serves existing local data. Use `POST .../sync` to force a refresh.

### User profile

`GET /api/users/:username`

```json
{
  "username": "example",
  "moviesCount": 500,
  "averageRating": 4.2,
  "favoriteGenres": [{ "name": "sci-fi", "count": 42 }],
  "lastSyncedAt": "2026-08-06T12:00:00.000Z",
  "followingCount": 1,
  "followersCount": 2,
  "externalLinks": [
    { "label": "linktr.ee", "url": "https://linktr.ee/example" }
  ],
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

| Param | Description |
| --- | --- |
| `ratingMin` / `ratingMax` | 0–5 |
| `year` | Exact year |
| `yearFrom` / `yearTo` | Range |
| `genre` | Exact genre token (lowercase; filled by Letterboxd film-page enrichment) |
| `director` | Case-insensitive contains |
| `sort` | `rating_desc`, `rating_asc`, `date_desc`, `date_asc`, `year_desc`, `year_asc`, `title_asc` |
| `page` / `limit` | Pagination (`limit` default **20**, max **100**) |

Paginated response: `{ items: Movie[], page, limit, total, totalPages }`. Omitting `limit` still applies the default of 20 — unbounded lists are not supported.

### Ratings

`GET /api/users/:username/ratings`

Returns average, count, best/worst films (full `Movie` objects), rating distribution.

### Favorites

`GET /api/users/:username/favorites`

Paginated favorite movies (liked flag or rating ≥ 4.5). Same query filters/sort/pagination as `/movies` (`limit` default **20**, max **100**).

Response: `{ items: Movie[], page, limit, total, totalPages }`.

Facet lists (same pagination; sorted by `count` desc, then `name` asc):

| Path | Description |
| --- | --- |
| `GET /api/users/:username/favorites/directors` | `{ items: [{ name, count }], page, limit, total, totalPages }` |
| `GET /api/users/:username/favorites/genres` | same shape |
| `GET /api/users/:username/favorites/years` | same shape |

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

Rule-based stub implementing `RecommendationEngine` for future AI swap.

## Errors

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User \"x\" not found",
    "requestId": "..."
  }
}
```

Common codes: `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `EXTERNAL_SERVICE_ERROR`, `SYNC_FAILED`, `INTERNAL_ERROR`.
