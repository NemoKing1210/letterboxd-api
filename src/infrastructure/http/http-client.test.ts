import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from './http-client';

describe('HttpClient proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
