import { describe, expect, it, vi } from 'vitest';
import type { SyncHistory, User } from '@prisma/client';
import type { SyncHistoryRepository, UserRepository } from '../../../infrastructure/database';
import { NotFoundError } from '../../../shared/errors/app-error';
import { ensureLocalUser } from './ensure-local-user';

function user(username: string): User {
  return {
    id: 'u1',
    username,
    followingCount: null,
    followersCount: null,
    externalLinks: [],
    favoriteFilms: [],
    recentLikes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function successfulSync(finishedAt: Date): SyncHistory {
  return {
    id: 's1',
    userId: 'u1',
    username: 'demo',
    status: 'SUCCESS',
    startedAt: finishedAt,
    finishedAt,
    error: null,
  };
}

function createSyncHistory(
  findLatestSuccessful: SyncHistoryRepository['findLatestSuccessful'] = vi.fn(async () => null),
): SyncHistoryRepository {
  return {
    create: vi.fn(),
    update: vi.fn(),
    findLatest: vi.fn(),
    findLatestSuccessful,
  };
}

describe('ensureLocalUser', () => {
  it('returns existing fresh user without syncing', async () => {
    const existing = user('demo');
    const users: UserRepository = {
      findByUsername: vi.fn(async () => existing),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn() };
    const finishedAt = new Date('2024-01-01T12:00:00.000Z');

    const result = await ensureLocalUser('Demo', {
      users,
      syncService,
      syncHistory: createSyncHistory(vi.fn(async () => successfulSync(finishedAt))),
      userSyncTtlSeconds: 43_200,
      now: () => new Date('2024-01-01T18:00:00.000Z'),
    });

    expect(result).toBe(existing);
    expect(syncService.syncLetterboxdUser).not.toHaveBeenCalled();
  });

  it('syncs then returns user when missing locally', async () => {
    const created = user('demo');
    const findByUsername = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    const users: UserRepository = {
      findByUsername,
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn(async () => ({})) };

    const result = await ensureLocalUser('demo', {
      users,
      syncService,
      syncHistory: createSyncHistory(),
      userSyncTtlSeconds: 43_200,
    });

    expect(syncService.syncLetterboxdUser).toHaveBeenCalledWith('demo');
    expect(result).toBe(created);
  });

  it('re-syncs when last successful sync is older than TTL', async () => {
    const existing = user('demo');
    const findByUsername = vi.fn(async () => existing);
    const users: UserRepository = {
      findByUsername,
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn(async () => ({})) };
    const finishedAt = new Date('2024-01-01T00:00:00.000Z');

    const result = await ensureLocalUser('demo', {
      users,
      syncService,
      syncHistory: createSyncHistory(vi.fn(async () => successfulSync(finishedAt))),
      userSyncTtlSeconds: 3600,
      now: () => new Date('2024-01-01T02:00:01.000Z'),
    });

    expect(syncService.syncLetterboxdUser).toHaveBeenCalledWith('demo');
    expect(result).toBe(existing);
  });

  it('re-syncs when no successful sync exists for a local user', async () => {
    const existing = user('demo');
    const users: UserRepository = {
      findByUsername: vi.fn(async () => existing),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn(async () => ({})) };

    await ensureLocalUser('demo', {
      users,
      syncService,
      syncHistory: createSyncHistory(vi.fn(async () => null)),
      userSyncTtlSeconds: 43_200,
    });

    expect(syncService.syncLetterboxdUser).toHaveBeenCalledWith('demo');
  });

  it('returns existing user when stale sync fails', async () => {
    const existing = user('demo');
    const users: UserRepository = {
      findByUsername: vi.fn(async () => existing),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = {
      syncLetterboxdUser: vi.fn(async () => {
        throw new Error('scrape failed');
      }),
    };
    const warn = vi.fn();
    const finishedAt = new Date('2024-01-01T00:00:00.000Z');

    const result = await ensureLocalUser('demo', {
      users,
      syncService,
      syncHistory: createSyncHistory(vi.fn(async () => successfulSync(finishedAt))),
      userSyncTtlSeconds: 3600,
      now: () => new Date('2024-01-02T00:00:00.000Z'),
      logger: { warn },
    });

    expect(result).toBe(existing);
    expect(warn).toHaveBeenCalled();
  });

  it('skips stale refresh when TTL is 0', async () => {
    const existing = user('demo');
    const users: UserRepository = {
      findByUsername: vi.fn(async () => existing),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn() };

    await ensureLocalUser('demo', {
      users,
      syncService,
      syncHistory: createSyncHistory(vi.fn(async () => null)),
      userSyncTtlSeconds: 0,
    });

    expect(syncService.syncLetterboxdUser).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when sync is disabled and user is missing', async () => {
    const users: UserRepository = {
      findByUsername: vi.fn(async () => null),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn() };

    await expect(
      ensureLocalUser('ghost', {
        users,
        syncService,
        syncHistory: createSyncHistory(),
        userSyncTtlSeconds: 43_200,
        autoSyncIfMissing: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(syncService.syncLetterboxdUser).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when sync completes but user is still missing', async () => {
    const users: UserRepository = {
      findByUsername: vi.fn(async () => null),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn(async () => ({})) };

    await expect(
      ensureLocalUser('ghost', {
        users,
        syncService,
        syncHistory: createSyncHistory(),
        userSyncTtlSeconds: 43_200,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
