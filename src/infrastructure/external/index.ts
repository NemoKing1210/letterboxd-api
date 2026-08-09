/**
 * External adapters (TMDB, OpenAI, …) live under infrastructure/external.
 * Features depend on ports; wire concretes in app/container.ts.
 */
export {
  OpenAiHttpClient,
  OpenAiEmbeddingProvider,
  OpenAiLlmProvider,
} from './openai';
