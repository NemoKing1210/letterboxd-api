import * as cheerio from 'cheerio';
import type { LetterboxdFilm, LetterboxdProfile } from './movie-provider';

const FILM_HREF_RE = /\/film\/([^/]+)\/?/;

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

    const title =
      poster.attr('data-film-name') ||
      poster.attr('data-item-name') ||
      node.find('img').attr('alt') ||
      slug.replace(/-/g, ' ');

    const yearRaw = poster.attr('data-film-release-year') || poster.attr('data-item-release-year');
    const year = yearRaw ? Number(yearRaw) : null;

    const rating =
      parseStars(node.find('.rating').text()) ??
      parseStars(node.find('.poster-viewingdata .rating').text()) ??
      null;

    const posterUrl =
      node.find('img').attr('src') ||
      node.find('img').attr('data-src') ||
      null;

    const liked = node.find('.like, .icon-liked').length > 0;

    films.push({
      slug,
      title: title.trim(),
      year: Number.isFinite(year) ? year : null,
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
      films.push({
        slug,
        title: $(el).text().trim() || slug.replace(/-/g, ' '),
        year: null,
        rating: null,
        poster: null,
        liked: false,
      });
    });
  }

  return films;
}

export function parseHasNextPage(html: string): boolean {
  const $ = cheerio.load(html);
  return (
    $('.paginate-nextprev .next').length > 0 ||
    $('a.next').length > 0 ||
    $('link[rel="next"]').length > 0
  );
}
