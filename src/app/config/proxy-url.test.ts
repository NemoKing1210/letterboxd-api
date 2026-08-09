import { describe, expect, it } from 'vitest';
import { resolveProxyUrl } from './proxy-url';

describe('resolveProxyUrl', () => {
  const httpProxy = 'http://proxy.example:8080';
  const httpsProxy = 'http://user:pass@secure-proxy.example:8443';

  it('returns undefined when no proxies configured', () => {
    expect(resolveProxyUrl('https://letterboxd.com', {})).toBeUndefined();
  });

  it('uses HTTPS_PROXY for https targets', () => {
    expect(
      resolveProxyUrl('https://letterboxd.com/user/', {
        httpProxy,
        httpsProxy,
      }),
    ).toBe(httpsProxy);
  });

  it('uses HTTP_PROXY for http targets', () => {
    expect(
      resolveProxyUrl('http://example.com', {
        httpProxy,
        httpsProxy,
      }),
    ).toBe(httpProxy);
  });

  it('falls back to HTTP_PROXY when only it is set for https', () => {
    expect(
      resolveProxyUrl('https://letterboxd.com', {
        httpProxy,
      }),
    ).toBe(httpProxy);
  });

  it('falls back to HTTPS_PROXY when only it is set for http', () => {
    expect(
      resolveProxyUrl('http://example.com', {
        httpsProxy,
      }),
    ).toBe(httpsProxy);
  });

  it('preserves credentials in proxy URL', () => {
    expect(
      resolveProxyUrl('https://letterboxd.com', {
        httpsProxy: 'http://user:s3cret@127.0.0.1:3128',
      }),
    ).toBe('http://user:s3cret@127.0.0.1:3128');
  });

  it('bypasses proxy for NO_PROXY exact host', () => {
    expect(
      resolveProxyUrl('https://letterboxd.com/film/', {
        httpsProxy,
        noProxy: 'letterboxd.com,localhost',
      }),
    ).toBeUndefined();
  });

  it('bypasses proxy for NO_PROXY host:port', () => {
    expect(
      resolveProxyUrl('https://api.local:8443/v1', {
        httpsProxy,
        noProxy: 'api.local:8443',
      }),
    ).toBeUndefined();
  });

  it('bypasses proxy for leading-dot suffix', () => {
    expect(
      resolveProxyUrl('https://cdn.example.com/x', {
        httpsProxy,
        noProxy: '.example.com',
      }),
    ).toBeUndefined();
  });

  it('bypasses all hosts when NO_PROXY is *', () => {
    expect(
      resolveProxyUrl('https://letterboxd.com', {
        httpsProxy,
        noProxy: '*',
      }),
    ).toBeUndefined();
  });

  it('returns undefined for invalid target URL', () => {
    expect(
      resolveProxyUrl('not-a-url', {
        httpsProxy,
      }),
    ).toBeUndefined();
  });

  it('ignores blank proxy strings', () => {
    expect(
      resolveProxyUrl('https://letterboxd.com', {
        httpProxy: '  ',
        httpsProxy: '',
      }),
    ).toBeUndefined();
  });
});
