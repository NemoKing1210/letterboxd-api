# ChatGPT Custom GPT + Actions

Connect the Letterboxd API to [ChatGPT Custom GPTs](https://chatgpt.com/) so you can ask about your films in natural language while ChatGPT loads your real watch history, ratings, and recommendations from this API.

Requires **ChatGPT Plus or Pro** (Custom GPTs).

## How it works

```text
You (ChatGPT UI) → Custom GPT → Actions (HTTPS) → your Letterboxd API → Postgres
```

ChatGPT chooses an Action from the curated OpenAPI schema, calls your deployed API, then answers in natural language. Taste “memory” is your synced Letterboxd data — not ChatGPT’s training data.

## Prerequisites

1. API deployed on a **public HTTPS** URL (e.g. Vercel — see [vercel.md](vercel.md)). `localhost` is not reachable from ChatGPT without a tunnel.
2. PostgreSQL with migrations applied (`bun run db:migrate` / `db:migrate:deploy`). Supabase: [supabase.md](supabase.md).
3. Auth enabled for production:
   ```env
   AUTH_ENABLED=true
   AUTH_METHODS=api_key
   AUTH_TOKENS=your-long-random-secret
   AUTH_PUBLIC_PATHS=/health,/privacy,/openapi-gpt-actions.yaml
   ```
4. Optional but recommended for good recommendations: `OPENAI_API_KEY` and pgvector (see `.env.example`).

Warm the user once before chatting:

```bash
curl -X POST -H "X-API-Key: YOUR_TOKEN" "https://YOUR_HOST/api/users/YOUR_USERNAME/sync"
```

## Assets served by this API

| Path | Purpose |
| --- | --- |
| `GET /openapi-gpt-actions.yaml` | Curated OpenAPI schema for GPT Actions (also in [`chatgpt-actions.yaml`](chatgpt-actions.yaml)) |
| `GET /privacy` | Short privacy notice URL for the GPT Builder |

These paths are public by default (listed in `AUTH_PUBLIC_PATHS`). All `/api/...` routes still require `X-API-Key` when auth is enabled.

## Create the Custom GPT

1. Open [ChatGPT](https://chatgpt.com/) → **Explore GPTs** → **Create** → **Configure**.
2. Name / description, e.g. “Letterboxd taste assistant”.
3. **Instructions** — paste the template below (replace `YOUR_USERNAME`).
4. **Actions** → **Create new action**:
   - Import schema from `https://YOUR_HOST/openapi-gpt-actions.yaml`, or paste the contents of [`chatgpt-actions.yaml`](chatgpt-actions.yaml).
   - Edit `servers[0].url` to your real base URL (**no trailing slash**), e.g. `https://letterboxd-api.vercel.app`.
5. **Authentication**:
   - Type: **API Key**
   - Auth Type: **Custom** (header)
   - Header name: `X-API-Key`
   - API Key: the same value as in `AUTH_TOKENS`
6. **Privacy Policy** URL: `https://YOUR_HOST/privacy`
7. Use **Test** next to each Action in the builder, then try the checklist below in the preview chat.

### Instructions template

```text
You are a personal film assistant backed by the Letterboxd API Actions.

Default Letterboxd username: YOUR_USERNAME

Rules:
- Before answering about watch history, ratings, favorites, genres, or recommendations, call the API. Never invent films the user watched or rated.
- For "what should I watch?" / recommendations → getRecommendations (limit 5–10).
- For "have I seen X?" / find a title → listMovies with q=<title> and a small limit, or searchMovies.
- For taste overview → getUserProfile and/or getStatistics.
- For best/worst ratings → getRatings.
- For favorites → listFavorites.
- Prefer limit ≤ 20. Do not try to download an entire diary in one call; paginate if needed.
- Call syncUser only when the user asks to refresh data or results look clearly stale (sync can be slow).
- When citing films, prefer title + year and Letterboxd url when the API returns them.
```

### Which Action to use

| User intent | operationId |
| --- | --- |
| Profile / pinned favorites | `getUserProfile` |
| Watched? / search title | `listMovies` (`q`) or `searchMovies` |
| Best / worst / average | `getRatings` |
| Favorites list | `listFavorites` |
| Top genres / directors | `getStatistics` |
| What should I watch? | `getRecommendations` |
| Refresh from Letterboxd | `syncUser` |

## Local development with a tunnel

ChatGPT cannot call `http://localhost:3000`. Expose the local server temporarily:

```bash
bun run dev
# other terminal:
ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000
```

Use the tunnel HTTPS URL as `servers[0].url` in the Action schema. Keep auth enabled so the tunnel is not an open scrape proxy.

## Evaluation checklist

In the GPT preview, try:

1. “Summarize my Letterboxd taste.”
2. “Have I watched Arrival?”
3. “What are my top genres?”
4. “Recommend 5 films I might like.”
5. “What are my highest-rated films?”

If an Action is never called: improve schema `description`s and mention the `operationId` names in Instructions. If auth fails: re-check header name `X-API-Key` and token value. Prefer testing the same URL with curl or the Bruno requests **Privacy Notice** / **OpenAPI GPT Actions Schema** first.

## Limits and caveats

- Large diaries: always use pagination; Actions responses should stay small.
- First sync / stale refresh on a username can be slow (Letterboxd scrape).
- Publishing to the GPT Store may require domain verification and a public privacy URL (you already have `/privacy`). Only-you / unlisted GPTs do not need the Store.
- This is not a full in-product chat API (see roadmap v4). Actions only run inside your Custom GPT.

## Related

- Full REST docs: [api.md](api.md)
- Interactive Swagger: `GET /docs` on a running server
- OpenAI GPT Actions guide: https://developers.openai.com/api/docs/actions/getting-started
