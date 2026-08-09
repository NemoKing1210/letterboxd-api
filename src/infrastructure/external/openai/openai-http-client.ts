import { ExternalServiceError } from '../../../shared/errors/app-error';
import { backoffDelayMs, sleep } from '../../../shared/utils';

export type OpenAiHttpClientOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
  maxRetries: number;
};

type JsonRecord = Record<string, unknown>;

/**
 * Minimal OpenAI REST client (embeddings + chat). No SDK — keeps the dependency surface small.
 */
export class OpenAiHttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: OpenAiHttpClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries;
  }

  async postJson<T>(path: string, body: JsonRecord): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const text = await response.text();
        const payload = parseJsonBody(text);

        if (response.status === 429 || response.status >= 500) {
          lastError = new ExternalServiceError(`OpenAI HTTP ${response.status}`, {
            status: response.status,
            body: summarizeBody(payload),
          });
          await sleep(backoffDelayMs(attempt));
          continue;
        }

        if (!response.ok) {
          throw new ExternalServiceError(`OpenAI HTTP ${response.status}`, {
            status: response.status,
            body: summarizeBody(payload),
          });
        }

        return payload as T;
      } catch (error) {
        if (error instanceof ExternalServiceError && !isTransientOpenAiError(error)) {
          throw error;
        }
        lastError = error;
        if (attempt < this.maxRetries - 1) {
          await sleep(backoffDelayMs(attempt));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ExternalServiceError('OpenAI request failed', undefined, lastError);
  }
}

function parseJsonBody(text: string): unknown {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

function summarizeBody(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const record = payload as JsonRecord;
  if ('error' in record) {
    return record.error;
  }
  return undefined;
}

function isTransientOpenAiError(error: ExternalServiceError): boolean {
  const status = (error.details as { status?: number } | undefined)?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}
