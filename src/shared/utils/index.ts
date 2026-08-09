const TITLE_YEAR_RE = /\s*\((\d{4})\)\s*$/;
const PLACEHOLDER_POSTER_RE = /empty-poster|static\/img\/empty/i;
const MIN_FILM_YEAR = 1888;
const MAX_FILM_YEAR = 2100;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/^@/, '');
}

export function decadeFromYear(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

export function isValidFilmYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_FILM_YEAR && year <= MAX_FILM_YEAR;
}

/** Strip trailing `(YYYY)` from a list title and return the year when valid. */
export function extractYearFromTitle(rawTitle: string): { title: string; year: number | null } {
  const trimmed = rawTitle.trim();
  const match = trimmed.match(TITLE_YEAR_RE);
  if (!match) {
    return { title: trimmed, year: null };
  }

  const year = Number(match[1]);
  if (!isValidFilmYear(year)) {
    return { title: trimmed, year: null };
  }

  return {
    title: trimmed.slice(0, match.index).trim() || trimmed,
    year,
  };
}

export function isPlaceholderPoster(url: string | null | undefined): boolean {
  if (!url) return true;
  return PLACEHOLDER_POSTER_RE.test(url);
}

export function filmPageUrl(slug: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/film/${slug}/`;
}

/** Run async work over items with a fixed concurrency limit. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]!, current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

export function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function topN(map: Map<string, number>, n: number): Array<{ name: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}
