import { describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCache } from './env';

const baseEnv = {
  DB_HOST: '127.0.0.1',
  DB_USER: 'postgres',
  DB_NAME: 'letterboxd',
  DB_PASSWORD: 'postgres',
};

describe('loadEnv OpenAI / recommendations', () => {
  it('defaults to auto engine without requiring an API key', () => {
    resetEnvCache();
    const env = loadEnv({ ...baseEnv } as NodeJS.ProcessEnv);
    expect(env.RECOMMENDATION_ENGINE).toBe('auto');
    expect(env.OPENAI_API_KEY).toBe('');
    expect(env.AI_RECOMMEND_USE_LLM).toBe(true);
    expect(env.AI_RECOMMEND_CANDIDATE_POOL).toBe(20);
  });

  it('parses OpenAI settings', () => {
    resetEnvCache();
    const env = loadEnv({
      ...baseEnv,
      OPENAI_API_KEY: ' sk-test ',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
      OPENAI_CHAT_MODEL: 'gpt-4o-mini',
      RECOMMENDATION_ENGINE: 'ai',
      AI_RECOMMEND_USE_LLM: 'false',
      AI_EMBED_BUDGET: '32',
    } as NodeJS.ProcessEnv);
    expect(env.OPENAI_API_KEY).toBe('sk-test');
    expect(env.RECOMMENDATION_ENGINE).toBe('ai');
    expect(env.AI_RECOMMEND_USE_LLM).toBe(false);
    expect(env.AI_EMBED_BUDGET).toBe(32);
  });

  it('rejects RECOMMENDATION_ENGINE=ai without OPENAI_API_KEY', () => {
    resetEnvCache();
    expect(() =>
      loadEnv({
        ...baseEnv,
        RECOMMENDATION_ENGINE: 'ai',
      } as NodeJS.ProcessEnv),
    ).toThrow(/OPENAI_API_KEY/);
  });
});
