import { describe, expect, it } from 'vitest';
import { toMovieDto } from './to-movie-dto';

describe('toMovieDto', () => {
  it('maps a user–movie entry to the full public movie shape', () => {
    const watchedDate = new Date('2024-06-01T12:00:00.000Z');

    expect(
      toMovieDto({
        rating: 4.5,
        favorite: true,
        watchedDate,
        movie: {
          id: 'm1',
          title: 'Arrival',
          year: 2016,
          slug: 'arrival',
          poster: 'https://example.com/arrival.jpg',
          genres: ['sci-fi', 'drama'],
          director: 'Denis Villeneuve',
        },
      }),
    ).toEqual({
      id: 'm1',
      title: 'Arrival',
      year: 2016,
      slug: 'arrival',
      url: 'https://letterboxd.com/film/arrival/',
      poster: 'https://example.com/arrival.jpg',
      genres: ['sci-fi', 'drama'],
      director: 'Denis Villeneuve',
      rating: 4.5,
      favorite: true,
      watchedDate: '2024-06-01T12:00:00.000Z',
    });
  });

  it('nulls watchedDate when missing', () => {
    const dto = toMovieDto({
      rating: null,
      favorite: false,
      watchedDate: null,
      movie: {
        id: 'm2',
        title: 'Untitled',
        year: null,
        slug: null,
        poster: null,
        genres: [],
        director: null,
      },
    });

    expect(dto.watchedDate).toBeNull();
    expect(dto.url).toBeNull();
    expect(dto.genres).toEqual([]);
  });
});
