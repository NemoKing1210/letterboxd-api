export type ProxyEnvParts = {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
};

/**
 * Resolve which proxy URL (if any) should be used for a target request URL.
 * Prefers scheme-specific proxy, falls back to the other when only one is set.
 */
export function resolveProxyUrl(targetUrl: string, parts: ProxyEnvParts): string | undefined {
  const httpProxy = parts.httpProxy?.trim() || undefined;
  const httpsProxy = parts.httpsProxy?.trim() || undefined;
  if (!httpProxy && !httpsProxy) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return undefined;
  }

  if (shouldBypassProxy(parsed, parts.noProxy)) {
    return undefined;
  }

  const isHttps = parsed.protocol === 'https:';
  if (isHttps) {
    return httpsProxy ?? httpProxy;
  }
  return httpProxy ?? httpsProxy;
}

function shouldBypassProxy(target: URL, noProxyRaw?: string): boolean {
  const noProxy = noProxyRaw?.trim();
  if (!noProxy) {
    return false;
  }

  const hostname = target.hostname.toLowerCase();
  const hostPort = target.port ? `${hostname}:${target.port}` : hostname;

  for (const entry of noProxy.split(',')) {
    const pattern = entry.trim().toLowerCase();
    if (!pattern) {
      continue;
    }
    if (pattern === '*') {
      return true;
    }
    if (pattern === hostPort || pattern === hostname) {
      return true;
    }
    // Leading-dot suffix match: ".example.com" matches "foo.example.com"
    if (pattern.startsWith('.') && (hostname.endsWith(pattern) || hostname === pattern.slice(1))) {
      return true;
    }
    // Bare suffix without leading dot: "example.com" matches "foo.example.com"
    if (!pattern.includes(':') && !pattern.startsWith('.') && hostname.endsWith(`.${pattern}`)) {
      return true;
    }
  }

  return false;
}
