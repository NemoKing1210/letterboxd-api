import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { extractYearFromTitle, isPlaceholderPoster, isValidFilmYear } from '../../shared/utils';
import type {
  LetterboxdDiaryEntry,
  LetterboxdFilm,
  LetterboxdFilmDetails,
  LetterboxdProfile,
} from './movie-provider';

const FILM_HREF_RE = /\/film\/([^/]+)\/?/;
const GENRE_HREF_RE = /\/films\/genre\/([^/]+)\/?/;
const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function parseStars(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.trim();
  if (!cleaned) return null;

  let rating = 0;
  for (const ch of cleaned) {
    if (ch === '★') rating += 1;
    else if (ch === '½') rating += 0.5;
  }

  return rating > 0 ? rating : null;
}

export function extractSlug(href: string | undefined | null): string | null {
  if (!href) return null;
  const match = href.match(FILM_HREF_RE);
  return match?.[1] ?? null;
}

export function parseProfileHtml(html: string, username: string): LetterboxdProfile {
  const $ = cheerio.load(html);
  const displayName =
    $('meta[property="og:title"]').attr('content')?.replace(/\s*•.*$/, '').trim() ||
    $('.profile-name h1').text().trim() ||
    null;

  const filmsText =
    $('a[href*="/films/"]').filter((_, el) => $(el).text().toLowerCase().includes('film')).first().text() ||
    $('.statistic a[href$="/films/"]').text() ||
    '';

  const filmsMatch = filmsText.replace(/,/g, '').match(/(\d+)/);
  const filmsCount = filmsMatch ? Number(filmsMatch[1]) : null;

  const bio = $('.profile-bio .body-text').text().trim() || null;

  return {
    username,
    displayName,
    filmsCount,
    bio,
  };
}

export function parseFilmsPageHtml(html: string): LetterboxdFilm[] {
  const $ = cheerio.load(html);
  const films: LetterboxdFilm[] = [];
  const seen = new Set<string>();

  $('li.poster-container, li.griditem, .poster-list li, ul.poster-list > li').each((_, el) => {
    const node = $(el);
    const poster = node.find('.film-poster, .react-component[data-item-slug], div[data-film-slug]').first();

    const slug =
      poster.attr('data-film-slug') ||
      poster.attr('data-item-slug') ||
      extractSlug(poster.find('a').attr('href')) ||
      extractSlug(node.find('a').attr('href'));

    if (!slug || seen.has(slug)) return;
    seen.add(slug);

    const rawTitle =
      poster.attr('data-film-name') ||
      poster.attr('data-item-name') ||
      node.find('img').attr('alt') ||
      slug.replace(/-/g, ' ');

    const yearRaw = poster.attr('data-film-release-year') || poster.attr('data-item-release-year');
    const yearFromAttr = yearRaw ? Number(yearRaw) : null;
    const { title, year: yearFromTitle } = extractYearFromTitle(rawTitle.trim());
    const year =
      yearFromAttr !== null && isValidFilmYear(yearFromAttr)
        ? yearFromAttr
        : yearFromTitle;

    const rating =
      parseStars(node.find('.rating').text()) ??
      parseStars(node.find('.poster-viewingdata .rating').text()) ??
      null;

    const rawPosterUrl =
      node.find('img').attr('src') ||
      node.find('img').attr('data-src') ||
      null;
    const posterUrl = isPlaceholderPoster(rawPosterUrl) ? null : rawPosterUrl;

    const liked = node.find('.like, .icon-liked').length > 0;

    films.push({
      slug,
      title,
      year,
      rating,
      poster: posterUrl,
      liked,
    });
  });

  // Fallback for simpler list markup
  if (films.length === 0) {
    $('a[href*="/film/"]').each((_, el) => {
      const href = $(el).attr('href');
      const slug = extractSlug(href);
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const { title, year } = extractYearFromTitle($(el).text().trim() || slug.replace(/-/g, ' '));
      films.push({
        slug,
        title,
        year,
        rating: null,
        poster: null,
        liked: false,
      });
    });
  }

  return films;
}

export function parseFilmPageHtml(html: string, slug: string): LetterboxdFilmDetails {
  const fromJsonLd = parseFilmJsonLd(html, slug);
  if (fromJsonLd) {
    return fromJsonLd;
  }

  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr('content')?.replace(/\s*•.*$/, '').trim();
  const heading = $('h1.headline-1, h1').first().text().trim();
  const { title, year: yearFromTitle } = extractYearFromTitle(ogTitle || heading || slug.replace(/-/g, ' '));

  const directors = $('a[href*="/director/"]')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const genres = collectGenreLinks($);
  const ogImage = $('meta[property="og:image"]').attr('content') ?? null;

  return {
    slug,
    title,
    year: yearFromTitle,
    poster: isPlaceholderPoster(ogImage) ? null : ogImage,
    genres,
    director: formatDirectors(directors),
  };
}

export function parsePosterJson(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { url?: unknown; url2x?: unknown };
    const url = typeof parsed.url === 'string' ? parsed.url : null;
    const url2x = typeof parsed.url2x === 'string' ? parsed.url2x : null;
    const chosen = url ?? url2x;
    return isPlaceholderPoster(chosen) ? null : chosen;
  } catch {
    return null;
  }
}

export function parseDiaryPageHtml(html: string): LetterboxdDiaryEntry[] {
  const $ = cheerio.load(html);
  const entries: LetterboxdDiaryEntry[] = [];
  const seen = new Set<string>();
  let currentYear: number | null = null;

  $('tr.diary-entry-row, tr.diary-entry, .diary-entry').each((_, el) => {
    const row = $(el);
    const slug =
      extractSlug(row.find('a[href*="/film/"]').attr('href')) ||
      row.attr('data-film-slug') ||
      row.attr('data-item-slug') ||
      null;

    if (!slug || seen.has(slug)) return;

    const yearText =
      row.find('.td-day .year, .td-calendar .year, .date-unit .year').first().text().trim() ||
      row.find('[data-viewing-year]').attr('data-viewing-year') ||
      '';
    const parsedYear = Number(yearText);
    if (isValidFilmYear(parsedYear)) {
      currentYear = parsedYear;
    }

    const dayText =
      row.find('.td-day .day, .td-calendar .day, .date-unit .day, strong.day').first().text().trim() ||
      row.find('[data-viewing-day]').attr('data-viewing-day') ||
      '';
    const monthText =
      row.find('.td-day .month, .td-calendar .month, .date-unit .month, small.month').first().text().trim() ||
      row.find('[data-viewing-month]').attr('data-viewing-month') ||
      '';

    const datetimeAttr =
      row.find('time[datetime]').attr('datetime') ||
      row.attr('data-viewing-date') ||
      row.find('[data-viewing-date]').attr('data-viewing-date') ||
      null;

    const watchedDate =
      parseIsoDate(datetimeAttr) ??
      buildDiaryDate({ dayText, monthText, year: currentYear });

    const rawTitle =
      row.find('h3 a, .td-film-details a, .headline-3 a').first().text().trim() ||
      slug.replace(/-/g, ' ');
    const { title, year } = extractYearFromTitle(rawTitle);
    const rating =
      parseStars(row.find('.rating').text()) ??
      parseStars(row.find('.poster-viewingdata .rating').text()) ??
      null;
    const liked = row.find('.like, .icon-liked').length > 0;

    seen.add(slug);
    entries.push({
      slug,
      title,
      year,
      rating,
      poster: null,
      liked,
      watchedDate,
      review: null,
    });
  });

  return entries;
}

export function parseHasNextPage(html: string): boolean {
  const $ = cheerio.load(html);
  return (
    $('.paginate-nextprev .next').length > 0 ||
    $('a.next').length > 0 ||
    $('link[rel="next"]').length > 0
  );
}

function parseFilmJsonLd(html: string, slug: string): LetterboxdFilmDetails | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).html() ?? '')
    .get();

  for (const raw of scripts) {
    const cleaned = raw
      .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\//, '')
      .replace(/\/\*\s*\]\]>\s*\*\/\s*$/, '')
      .trim();
    if (!cleaned) continue;

    try {
      const data = JSON.parse(cleaned) as Record<string, unknown>;
      if (data['@type'] !== 'Movie' && data['@type'] !== 'TVSeries') {
        continue;
      }

      const name = typeof data.name === 'string' ? data.name.trim() : slug.replace(/-/g, ' ');
      const year = yearFromDateCreated(data.dateCreated) ?? extractYearFromTitle(name).year;
      const { title } = extractYearFromTitle(name);
      const genres = normalizeGenres(data.genre);
      const director = formatDirectors(extractDirectorNames(data.director));
      const poster =
        typeof data.image === 'string' && !isPlaceholderPoster(data.image) ? data.image : null;

      const fallbackGenres = genres.length > 0 ? genres : collectGenreLinks($);

      return {
        slug,
        title,
        year,
        poster,
        genres: fallbackGenres,
        director,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function yearFromDateCreated(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const year = Number(value.slice(0, 4));
  return isValidFilmYear(year) ? year : null;
}

function normalizeGenres(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const genres: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    genres.push(normalized);
  }

  return genres;
}

function extractDirectorNames(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const names: string[] = [];

  for (const item of list) {
    if (typeof item === 'string' && item.trim()) {
      names.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object' && 'name' in item) {
      const name = (item as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim()) {
        names.push(name.trim());
      }
    }
  }

  return names;
}

function formatDirectors(names: string[]): string | null {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  return unique.length > 0 ? unique.join(', ') : null;
}

function collectGenreLinks($: CheerioAPI): string[] {
  const genres: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/films/genre/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(GENRE_HREF_RE);
    const fromHref = match?.[1]?.replace(/-/g, ' ').toLowerCase();
    const fromText = $(el).text().trim().toLowerCase();
    const genre = fromText || fromHref;
    if (!genre || seen.has(genre)) return;
    seen.add(genre);
    genres.push(genre);
  });

  return genres;
}

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildDiaryDate(parts: {
  dayText: string;
  monthText: string;
  year: number | null;
}): string | null {
  const day = Number(parts.dayText);
  const month = MONTH_INDEX[parts.monthText.trim().toLowerCase()];
  if (!parts.year || !Number.isInteger(day) || day < 1 || day > 31 || month === undefined) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
