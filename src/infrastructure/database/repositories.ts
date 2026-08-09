import type { Movie, Prisma, PrismaClient, SyncHistory, SyncStatus, User, UserMovie } from '@prisma/client';
import { MAX_LIMIT } from '../../shared/constants';
import { clamp } from '../../shared/utils';

export type UserWithMovies = User & {
  movies: Array<UserMovie & { movie: Movie }>;
};

export type MovieListFilters = {
  ratingMin?: number;
  ratingMax?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  genre?: string;
  director?: string;
  sort?: 'rating_desc' | 'rating_asc' | 'date_desc' | 'date_asc' | 'year_desc' | 'year_asc' | 'title_asc';
  page: number;
  limit: number;
};

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  findByUsernameWithMovies(username: string): Promise<UserWithMovies | null>;
  upsertByUsername(username: string): Promise<User>;
}

export interface MovieRepository {
  findBySlugs(slugs: string[]): Promise<Map<string, Movie>>;
  upsertBySlug(data: {
    slug: string;
    title: string;
    year: number | null;
    poster: string | null;
    genres?: string[];
    director?: string | null;
    enriched?: boolean;
  }): Promise<Movie>;
}

export interface UserMovieRepository {
  upsert(data: {
    userId: string;
    movieId: string;
    rating: number | null;
    favorite: boolean;
    watchedDate: Date | null;
  }): Promise<UserMovie>;
  findFiltered(userId: string, filters: MovieListFilters): Promise<{ items: Array<UserMovie & { movie: Movie }>; total: number }>;
  findAllForUser(userId: string): Promise<Array<UserMovie & { movie: Movie }>>;
}

export interface SyncHistoryRepository {
  create(data: { username: string; userId?: string; status: SyncStatus }): Promise<SyncHistory>;
  update(
    id: string,
    data: { status: SyncStatus; finishedAt?: Date; error?: string | null; userId?: string },
  ): Promise<SyncHistory>;
  findLatest(username: string): Promise<SyncHistory | null>;
  findLatestSuccessful(username: string): Promise<SyncHistory | null>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  }

  findByUsernameWithMovies(username: string): Promise<UserWithMovies | null> {
    return this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { movies: { include: { movie: true } } },
    });
  }

  upsertByUsername(username: string): Promise<User> {
    const normalized = username.toLowerCase();
    return this.prisma.user.upsert({
      where: { username: normalized },
      create: { username: normalized },
      update: {},
    });
  }
}

export class PrismaMovieRepository implements MovieRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySlugs(slugs: string[]): Promise<Map<string, Movie>> {
    const unique = [...new Set(slugs.filter(Boolean))];
    if (unique.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.movie.findMany({
      where: { slug: { in: unique } },
    });

    const map = new Map<string, Movie>();
    for (const row of rows) {
      if (row.slug) {
        map.set(row.slug, row);
      }
    }
    return map;
  }

  upsertBySlug(data: {
    slug: string;
    title: string;
    year: number | null;
    poster: string | null;
    genres?: string[];
    director?: string | null;
    enriched?: boolean;
  }): Promise<Movie> {
    const genres = data.genres ?? [];
    return this.prisma.movie.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        title: data.title,
        year: data.year,
        poster: data.poster,
        genres,
        director: data.director ?? null,
        enriched: data.enriched ?? false,
      },
      update: {
        title: data.title,
        ...(data.year !== null ? { year: data.year } : {}),
        ...(data.poster !== null ? { poster: data.poster } : {}),
        ...(genres.length > 0 ? { genres } : {}),
        ...(data.director ? { director: data.director } : {}),
        ...(data.enriched === true ? { enriched: true } : {}),
      },
    });
  }
}

export class PrismaUserMovieRepository implements UserMovieRepository {
  constructor(private readonly prisma: PrismaClient) {}

  upsert(data: {
    userId: string;
    movieId: string;
    rating: number | null;
    favorite: boolean;
    watchedDate: Date | null;
  }): Promise<UserMovie> {
    return this.prisma.userMovie.upsert({
      where: {
        userId_movieId: {
          userId: data.userId,
          movieId: data.movieId,
        },
      },
      create: data,
      update: {
        rating: data.rating,
        favorite: data.favorite,
        ...(data.watchedDate !== null ? { watchedDate: data.watchedDate } : {}),
      },
    });
  }

  async findFiltered(
    userId: string,
    filters: MovieListFilters,
  ): Promise<{ items: Array<UserMovie & { movie: Movie }>; total: number }> {
    const where: Prisma.UserMovieWhereInput = {
      userId,
      ...(filters.ratingMin !== undefined || filters.ratingMax !== undefined
        ? {
            rating: {
              ...(filters.ratingMin !== undefined ? { gte: filters.ratingMin } : {}),
              ...(filters.ratingMax !== undefined ? { lte: filters.ratingMax } : {}),
            },
          }
        : {}),
      movie: {
        ...(filters.year !== undefined ? { year: filters.year } : {}),
        ...(filters.yearFrom !== undefined || filters.yearTo !== undefined
          ? {
              year: {
                ...(filters.yearFrom !== undefined ? { gte: filters.yearFrom } : {}),
                ...(filters.yearTo !== undefined ? { lte: filters.yearTo } : {}),
              },
            }
          : {}),
        ...(filters.genre
          ? { genres: { has: filters.genre.toLowerCase() } }
          : {}),
        ...(filters.director
          ? { director: { contains: filters.director, mode: 'insensitive' } }
          : {}),
      },
    };

    const orderBy = this.buildOrderBy(filters.sort);
    const limit = clamp(filters.limit, 1, MAX_LIMIT);
    const page = Math.max(1, filters.page);
    const [total, items] = await Promise.all([
      this.prisma.userMovie.count({ where }),
      this.prisma.userMovie.findMany({
        where,
        include: { movie: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items, total };
  }

  findAllForUser(userId: string): Promise<Array<UserMovie & { movie: Movie }>> {
    return this.prisma.userMovie.findMany({
      where: { userId },
      include: { movie: true },
    });
  }

  private buildOrderBy(sort?: MovieListFilters['sort']): Prisma.UserMovieOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating_asc':
        return [{ rating: 'asc' }, { movie: { title: 'asc' } }];
      case 'date_desc':
        return [{ watchedDate: 'desc' }, { movie: { title: 'asc' } }];
      case 'date_asc':
        return [{ watchedDate: 'asc' }, { movie: { title: 'asc' } }];
      case 'year_desc':
        return [{ movie: { year: 'desc' } }, { movie: { title: 'asc' } }];
      case 'year_asc':
        return [{ movie: { year: 'asc' } }, { movie: { title: 'asc' } }];
      case 'title_asc':
        return [{ movie: { title: 'asc' } }];
      case 'rating_desc':
      default:
        return [{ rating: 'desc' }, { movie: { title: 'asc' } }];
    }
  }
}

export class PrismaSyncHistoryRepository implements SyncHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: { username: string; userId?: string; status: SyncStatus }): Promise<SyncHistory> {
    return this.prisma.syncHistory.create({
      data: {
        username: data.username.toLowerCase(),
        userId: data.userId,
        status: data.status,
      },
    });
  }

  update(
    id: string,
    data: { status: SyncStatus; finishedAt?: Date; error?: string | null; userId?: string },
  ): Promise<SyncHistory> {
    return this.prisma.syncHistory.update({
      where: { id },
      data,
    });
  }

  findLatest(username: string): Promise<SyncHistory | null> {
    return this.prisma.syncHistory.findFirst({
      where: { username: username.toLowerCase() },
      orderBy: { startedAt: 'desc' },
    });
  }

  findLatestSuccessful(username: string): Promise<SyncHistory | null> {
    return this.prisma.syncHistory.findFirst({
      where: { username: username.toLowerCase(), status: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
    });
  }
}
