import { resolveProxyUrl, type ProxyEnvParts } from '../../app/config/proxy-url';
import { ExternalServiceError } from '../../shared/errors/app-error';
import { sleep } from '../../shared/utils';

export type HttpClientOptions = {
  timeoutMs: number;
  maxRetries?: number;
  userAgent?: string;
  proxy?: ProxyEnvParts;
};

type FetchInitWithProxy = RequestInit & { proxy?: string };

export class HttpClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private readonly proxy?: ProxyEnvParts;

  constructor(options: HttpClientOptions) {
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries ?? 3;
    this.userAgent =
      options.userAgent ??
      'LetterboxdIntelligenceAPI/1.0 (+https://github.com/letterboxd-intelligence-api; personal use)';
    this.proxy = options.proxy;
  }

  async getText(url: string): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const proxyUrl = this.proxy ? resolveProxyUrl(url, this.proxy) : undefined;
        const init: FetchInitWithProxy = {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml',
          },
          ...(proxyUrl ? { proxy: proxyUrl } : {}),
        };

        const response = await fetch(url, init);

        if (response.status === 404) {
          throw new ExternalServiceError(`Resource not found: ${url}`, { status: 404 });
        }

        if (response.status === 429 || response.status >= 500) {
          lastError = new ExternalServiceError(`Transient HTTP ${response.status} for ${url}`, {
            status: response.status,
          });
          await sleep(250 * 2 ** attempt);
          continue;
        }

        if (!response.ok) {
          throw new ExternalServiceError(`HTTP ${response.status} for ${url}`, {
            status: response.status,
          });
        }

        return await response.text();
      } catch (error) {
        if (error instanceof ExternalServiceError && error.details && (error.details as { status?: number }).status === 404) {
          throw error;
        }
        lastError = error;
        if (attempt < this.maxRetries - 1) {
          await sleep(250 * 2 ** attempt);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ExternalServiceError(`Failed to fetch ${url}`, undefined, lastError);
  }
}
