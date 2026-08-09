import type { Movie, Prisma, PrismaClient, SyncHistory, SyncStatus, User, UserMovie } from '@prisma/client';
import { FAVORITE_RATING_THRESHOLD, MAX_LIMIT } from '../../shared/constants';
import { clamp } from '../../shared/utils';

export type UserWithMovies = User & {
  movies: Array<UserMovie & { movie: Movie }>;
};

export type MovieListSort =
  | 'rating_desc'
  | 'rating_asc'
  | 'date_desc'
  | 'date_asc'
  | 'year_desc'
  | 'year_asc'
  | 'title_asc';

export type MovieListFilters = {
  ratingMin?: number;
  ratingMax?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  genre?: string;
  director?: string;
  /** Case-insensitive contains on movie title or slug. */
  q?: string;
  sort?: MovieListSort;
  /** When true, only liked films: favorite flag or rating >= FAVORITE_RATING_THRESHOLD. */
  likedOnly?: boolean;
  page: number;
  limit: number;
};

export type MovieSearchQuery = {
  /** Extra Prisma where clause (excluding userId; merged with AND). */
  filterWhere?: Prisma.UserMovieWhereInput;
  sort?: MovieListSort;
  page: number;
  limit: number;
};

export type UserProfileSnapshot = {
  followingCount: number | null;
  followersCount: number | null;
  externalLinks: Array<{ label: string; url: string }>;
  favoriteFilms: Array<{ slug: string; title: string; year: number | null; poster: string | null }>;
  recentLikes: Array<{ slug: string; title: string; year: number | null; poster: string | null }>;
};

export type UserListSort =
  | 'username_asc'
  | 'username_desc'
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'followers_desc'
  | 'followers_asc'
  | 'following_desc'
  | 'following_asc'
  | 'movies_desc'
  | 'movies_asc';

export type UserListFilters = {
  /** Case-insensitive contains on username. */
  q?: string;
  followersMin?: number;
  followersMax?: number;
  followingMin?: number;
  followingMax?: number;
  moviesMin?: number;
  moviesMax?: number;
  sort?: UserListSort;
  page: number;
  limit: number;
};

export type UserListRow = {
  user: User;
  moviesCount: number;
  lastSyncedAt: Date | null;
};

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  findByUsernameWithMovies(username: string): Promise<UserWithMovies | null>;
  upsertByUsername(username: string, profile?: UserProfileSnapshot): Promise<User>;
  findFiltered(filters: UserListFilters): Promise<{ items: UserListRow[]; total: number }>;
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
  findBySearch(
    userId: string,
    query: MovieSearchQuery,
  ): Promise<{ items: Array<UserMovie & { movie: Movie }>; total: number }>;
  findAllForUser(userId: string): Promise<Array<UserMovie & { movie: Movie }>>;
  findAllForUsers(userIds: string[]): Promise<Array<UserMovie & { movie: Movie }>>;
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

  upsertByUsername(username: string, profile?: UserProfileSnapshot): Promise<User> {
    const normalized = username.toLowerCase();
    const profileData = profile
      ? {
          followingCount: profile.followingCount,
          followersCount: profile.followersCount,
          externalLinks: profile.externalLinks,
          favoriteFilms: profile.favoriteFilms,
          recentLikes: profile.recentLikes,
        }
      : {};

    return this.prisma.user.upsert({
      where: { username: normalized },
      create: { username: normalized, ...profileData },
      update: profileData,
    });
  }

  async findFiltered(filters: UserListFilters): Promise<{ items: UserListRow[]; total: number }> {
    const limit = clamp(filters.limit, 1, MAX_LIMIT);
    const page = Math.max(1, filters.page);
    const where = await this.buildUserListWhere(filters);
    const orderBy = this.buildUserListOrderBy(filters.sort);

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { movies: true } },
          syncs: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: { finishedAt: true, startedAt: true },
          },
        },
      }),
    ]);

    return {
      total,
      items: rows.map((row) => {
        const latest = row.syncs[0];
        return {
          user: {
            id: row.id,
            username: row.username,
            followingCount: row.followingCount,
            followersCount: row.followersCount,
            externalLinks: row.externalLinks,
            favoriteFilms: row.favoriteFilms,
            recentLikes: row.recentLikes,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
          moviesCount: row._count.movies,
          lastSyncedAt: latest?.finishedAt ?? latest?.startedAt ?? null,
        };
      }),
    };
  }

  private async buildUserListWhere(filters: UserListFilters): Promise<Prisma.UserWhereInput> {
    const and: Prisma.UserWhereInput[] = [];

    if (filters.q) {
      and.push({ username: { contains: filters.q.toLowerCase(), mode: 'insensitive' } });
    }
    if (filters.followersMin !== undefined || filters.followersMax !== undefined) {
      and.push({
        followersCount: {
          ...(filters.followersMin !== undefined ? { gte: filters.followersMin } : {}),
          ...(filters.followersMax !== undefined ? { lte: filters.followersMax } : {}),
        },
      });
    }
    if (filters.followingMin !== undefined || filters.followingMax !== undefined) {
      and.push({
        followingCount: {
          ...(filters.followingMin !== undefined ? { gte: filters.followingMin } : {}),
          ...(filters.followingMax !== undefined ? { lte: filters.followingMax } : {}),
        },
      });
    }

    const movieCountIds = await this.resolveUserIdsByMovieCount(
      filters.moviesMin,
      filters.moviesMax,
    );
    if (movieCountIds !== null) {
      and.push({ id: { in: movieCountIds } });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  /**
   * Returns matching user ids when moviesMin/Max are set; `null` means no movie-count filter.
   * Includes users with zero diary entries when the range allows 0.
   */
  private async resolveUserIdsByMovieCount(
    moviesMin?: number,
    moviesMax?: number,
  ): Promise<string[] | null> {
    if (moviesMin === undefined && moviesMax === undefined) {
      return null;
    }

    const grouped = await this.prisma.userMovie.groupBy({
      by: ['userId'],
      _count: { _all: true },
    });

    const ids = new Set<string>();
    for (const row of grouped) {
      const count = row._count._all;
      if (moviesMin !== undefined && count < moviesMin) continue;
      if (moviesMax !== undefined && count > moviesMax) continue;
      ids.add(row.userId);
    }

    const includesZero =
      (moviesMin === undefined || moviesMin <= 0) &&
      (moviesMax === undefined || moviesMax >= 0);
    if (includesZero) {
      const zeroMovieUsers = await this.prisma.user.findMany({
        where: { movies: { none: {} } },
        select: { id: true },
      });
      for (const user of zeroMovieUsers) {
        ids.add(user.id);
      }
    }

    return [...ids];
  }

  private buildUserListOrderBy(
    sort?: UserListSort,
  ): Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[] {
    switch (sort) {
      case 'username_desc':
        return { username: 'desc' };
      case 'created_desc':
        return [{ createdAt: 'desc' }, { username: 'asc' }];
      case 'created_asc':
        return [{ createdAt: 'asc' }, { username: 'asc' }];
      case 'updated_desc':
        return [{ updatedAt: 'desc' }, { username: 'asc' }];
      case 'updated_asc':
        return [{ updatedAt: 'asc' }, { username: 'asc' }];
      case 'followers_desc':
        return [{ followersCount: 'desc' }, { username: 'asc' }];
      case 'followers_asc':
        return [{ followersCount: 'asc' }, { username: 'asc' }];
      case 'following_desc':
        return [{ followingCount: 'desc' }, { username: 'asc' }];
      case 'following_asc':
        return [{ followingCount: 'asc' }, { username: 'asc' }];
      case 'movies_desc':
        return [{ movies: { _count: 'desc' } }, { username: 'asc' }];
      case 'movies_asc':
        return [{ movies: { _count: 'asc' } }, { username: 'asc' }];
      case 'username_asc':
      default:
        return { username: 'asc' };
    }
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
    const andClauses: Prisma.UserMovieWhereInput[] = [];
    if (filters.likedOnly) {
      andClauses.push({
        OR: [{ favorite: true }, { rating: { gte: FAVORITE_RATING_THRESHOLD } }],
      });
    }
    if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) {
      andClauses.push({
        rating: {
          ...(filters.ratingMin !== undefined ? { gte: filters.ratingMin } : {}),
          ...(filters.ratingMax !== undefined ? { lte: filters.ratingMax } : {}),
        },
      });
    }

    const where: Prisma.UserMovieWhereInput = {
      userId,
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
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
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { slug: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };

    return this.paginate(where, filters.sort, filters.page, filters.limit);
  }

  async findBySearch(
    userId: string,
    query: MovieSearchQuery,
  ): Promise<{ items: Array<UserMovie & { movie: Movie }>; total: number }> {
    const where: Prisma.UserMovieWhereInput = {
      userId,
      ...(query.filterWhere ? { AND: [query.filterWhere] } : {}),
    };
    return this.paginate(where, query.sort, query.page, query.limit);
  }

  findAllForUser(userId: string): Promise<Array<UserMovie & { movie: Movie }>> {
    return this.prisma.userMovie.findMany({
      where: { userId },
      include: { movie: true },
    });
  }

  findAllForUsers(userIds: string[]): Promise<Array<UserMovie & { movie: Movie }>> {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.userMovie.findMany({
      where: { userId: { in: userIds } },
      include: { movie: true },
    });
  }

  private async paginate(
    where: Prisma.UserMovieWhereInput,
    sort: MovieListSort | undefined,
    pageInput: number,
    limitInput: number,
  ): Promise<{ items: Array<UserMovie & { movie: Movie }>; total: number }> {
    const orderBy = this.buildOrderBy(sort);
    const limit = clamp(limitInput, 1, MAX_LIMIT);
    const page = Math.max(1, pageInput);
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

  private buildOrderBy(sort?: MovieListSort): Prisma.UserMovieOrderByWithRelationInput[] {
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
