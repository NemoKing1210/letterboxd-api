import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiEmbeddingProvider } from './openai-embedding-provider';
import { OpenAiHttpClient } from './openai-http-client';
import { OpenAiLlmProvider } from './openai-llm-provider';
import { OPENAI_EMBEDDING_DIMENSIONS } from '../../../shared/constants';

describe('OpenAI providers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('embeds texts via OpenAI HTTP API', async () => {
    const embedding = Array.from({ length: OPENAI_EMBEDDING_DIMENSIONS }, () => 0.1);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            model: 'text-embedding-3-small',
            data: [{ index: 0, embedding }],
          }),
          { status: 200 },
        ),
      ),
    );

    const client = new OpenAiHttpClient({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      maxRetries: 1,
    });
    const provider = new OpenAiEmbeddingProvider({
      client,
      model: 'text-embedding-3-small',
      dimensions: OPENAI_EMBEDDING_DIMENSIONS,
    });

    const result = await provider.embed({ texts: ['hello'] });
    expect(result.embeddings[0]).toHaveLength(OPENAI_EMBEDDING_DIMENSIONS);
    expect(fetch).toHaveBeenCalled();
  });

  it('parses chat JSON completions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":[{"movieId":"m1","reason":"ok"}]}' } }],
          }),
          { status: 200 },
        ),
      ),
    );

    const client = new OpenAiHttpClient({
      apiKey: 'test-key',
      timeoutMs: 5_000,
      maxRetries: 1,
    });
    const llm = new OpenAiLlmProvider({ client, model: 'gpt-4o-mini' });
    const payload = await llm.completeJson<{ items: Array<{ movieId: string }> }>({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(payload.items[0]?.movieId).toBe('m1');
  });
});
