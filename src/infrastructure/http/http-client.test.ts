import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCRAPER_HEADERS,
  DEFAULT_SCRAPER_USER_AGENT,
  HttpClient,
  isCloudflareChallenge,
} from './http-client';

describe('HttpClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends browser-like navigation headers with scraper User-Agent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html><title>Profile</title></html>',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({ timeoutMs: 5_000, maxRetries: 1 });
    await client.getText('https://letterboxd.com/user/');

    const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
    expect(init.headers['User-Agent']).toBe(DEFAULT_SCRAPER_USER_AGENT);
    expect(init.headers['Sec-Fetch-Dest']).toBe(DEFAULT_SCRAPER_HEADERS['Sec-Fetch-Dest']);
    expect(init.headers['Sec-Fetch-Mode']).toBe(DEFAULT_SCRAPER_HEADERS['Sec-Fetch-Mode']);
    expect(init.headers['Accept-Language']).toBe(DEFAULT_SCRAPER_HEADERS['Accept-Language']);
  });

  it('retries Cloudflare challenge responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '<html><title>Just a moment...</title></html>',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><title>Profile</title></html>',
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({ timeoutMs: 5_000, maxRetries: 2 });
    const html = await client.getText('https://letterboxd.com/user/');

    expect(html).toContain('Profile');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes proxy option for https when HTTPS_PROXY is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html/>',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({
      timeoutMs: 5_000,
      maxRetries: 1,
      proxy: {
        httpsProxy: 'http://user:pass@proxy.example:8080',
      },
    });

    await client.getText('https://letterboxd.com/user/');

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as { proxy?: string };
    expect(init.proxy).toBe('http://user:pass@proxy.example:8080');
  });

  it('omits proxy when host is in NO_PROXY', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html/>',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({
      timeoutMs: 5_000,
      maxRetries: 1,
      proxy: {
        httpsProxy: 'http://proxy.example:8080',
        noProxy: 'letterboxd.com',
      },
    });

    await client.getText('https://letterboxd.com/user/');

    const init = fetchMock.mock.calls[0]?.[1] as { proxy?: string };
    expect(init.proxy).toBeUndefined();
  });

  it('omits proxy when none configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html/>',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClient({
      timeoutMs: 5_000,
      maxRetries: 1,
    });

    await client.getText('https://letterboxd.com/user/');

    const init = fetchMock.mock.calls[0]?.[1] as { proxy?: string };
    expect(init.proxy).toBeUndefined();
  });
});

describe('isCloudflareChallenge', () => {
  it('detects challenge HTML on 403 and 200', () => {
    expect(isCloudflareChallenge(403, '<title>Just a moment...</title>')).toBe(true);
    expect(isCloudflareChallenge(200, 'cf-browser-verification')).toBe(true);
    expect(isCloudflareChallenge(200, '<title>Profile</title>')).toBe(false);
    expect(isCloudflareChallenge(200, 'challenge-platform')).toBe(false);
    expect(isCloudflareChallenge(404, 'Just a moment')).toBe(false);
  });
});
