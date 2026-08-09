import { describe, expect, it } from 'vitest';
import { moviesToCsv } from './movies-to-csv';
import type { MovieDto } from '../../movies/schemas/movie-schemas';

const sample: MovieDto = {
  id: 'm1',
  title: 'Arrival, Part 1',
  year: 2016,
  slug: 'arrival',
  url: 'https://letterboxd.com/film/arrival/',
  poster: null,
  genres: ['sci-fi', 'drama'],
  director: 'Denis "Villeneuve"',
  rating: 4.5,
  favorite: true,
  watchedDate: '2024-06-01T12:00:00.000Z',
};

describe('moviesToCsv', () => {
  it('writes header and quoted cells when needed', () => {
    const csv = moviesToCsv([sample]);
    expect(csv.startsWith('id,title,year,slug,url,poster,genres,director,rating,favorite,watchedDate\r\n')).toBe(
      true,
    );
    expect(csv).toContain('"Arrival, Part 1"');
    expect(csv).toContain('sci-fi|drama');
    expect(csv).toContain('"Denis ""Villeneuve"""');
    expect(csv).toContain(',true,');
  });

  it('returns header-only CSV for empty list', () => {
    expect(moviesToCsv([])).toBe(
      'id,title,year,slug,url,poster,genres,director,rating,favorite,watchedDate\r\n',
    );
  });
});
