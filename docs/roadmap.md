# Product Roadmap

See also root [ROADMAP.md](../ROADMAP.md).

```mermaid
flowchart LR
  v1[v1 Scraper API] --> v2[v2 TMDB Metadata]
  v2 --> v3[v3 AI Recommendations]
  v3 --> v4[v4 Personal Assistant]
```

## v1

Foundation API: scrape, store, filter, statistics.

## v2

Enrich films via TMDB (posters, genres, directors, cast).

## v3

OpenAI embeddings + pgvector ANN (+ optional LLM reasons). Full review-corpus RAG still pending.

## v4

Conversational assistant, Telegram bot, web dashboard, multi-source import.
