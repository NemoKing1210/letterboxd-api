import { resolveProxyUrl, type ProxyEnvParts } from '../../app/config/proxy-url';
import { ExternalServiceError } from '../../shared/errors/app-error';
import { sleep } from '../../shared/utils';

export const DEFAULT_SCRAPER_USER_AGENT =
  'LetterboxdIntelligenceAPI/1.0 (+https://github.com/letterboxd-intelligence-api; personal use)';

/** Navigation-like headers — Cloudflare often challenges bare scrapes without these. */
export const DEFAULT_SCRAPER_HEADERS: Record<string, string> = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/** Markers unique to the interstitial challenge page (not present on real Letterboxd HTML). */
const CLOUDFLARE_CHALLENGE_MARKERS = ['Just a moment', 'cf-browser-verification'] as const;

export type HttpClientOptions = {
  timeoutMs: number;
  maxRetries?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  proxy?: ProxyEnvParts;
};

type FetchInitWithProxy = RequestInit & { proxy?: string };

export class HttpClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly headers: Record<string, string>;
  private readonly proxy?: ProxyEnvParts;

  constructor(options: HttpClientOptions) {
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries ?? 3;
    this.headers = {
      ...DEFAULT_SCRAPER_HEADERS,
      ...options.headers,
      'User-Agent': options.userAgent ?? DEFAULT_SCRAPER_USER_AGENT,
    };
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
          headers: this.headers,
          ...(proxyUrl ? { proxy: proxyUrl } : {}),
        };

        const response = await fetch(url, init);

        if (response.status === 404) {
          throw new ExternalServiceError(`Resource not found: ${url}`, { status: 404 });
        }

        const body = await response.text();

        if (isCloudflareChallenge(response.status, body)) {
          lastError = new ExternalServiceError(`Cloudflare challenge for ${url}`, {
            status: response.status,
          });
          await sleep(250 * 2 ** attempt);
          continue;
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

        return body;
      } catch (error) {
        if (
          error instanceof ExternalServiceError &&
          error.details &&
          (error.details as { status?: number }).status === 404
        ) {
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

export function isCloudflareChallenge(status: number, body: string): boolean {
  if (status === 403) {
    return CLOUDFLARE_CHALLENGE_MARKERS.some((marker) => body.includes(marker));
  }
  if (status === 200 || status === 503) {
    return CLOUDFLARE_CHALLENGE_MARKERS.some((marker) => body.includes(marker));
  }
  return false;
}
