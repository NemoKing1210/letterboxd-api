import { describe, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';
import type { UserRepository } from '../../../infrastructure/database';
import { NotFoundError } from '../../../shared/errors/app-error';
import { ensureLocalUser } from './ensure-local-user';

function user(username: string): User {
  return {
    id: 'u1',
    username,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ensureLocalUser', () => {
  it('returns existing user without syncing', async () => {
    const existing = user('demo');
    const users: UserRepository = {
      findByUsername: vi.fn(async () => existing),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn() };

    const result = await ensureLocalUser('Demo', { users, syncService });

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

    const result = await ensureLocalUser('demo', { users, syncService });

    expect(syncService.syncLetterboxdUser).toHaveBeenCalledWith('demo');
    expect(result).toBe(created);
  });

  it('throws NotFoundError when sync is disabled and user is missing', async () => {
    const users: UserRepository = {
      findByUsername: vi.fn(async () => null),
      findByUsernameWithMovies: vi.fn(),
      upsertByUsername: vi.fn(),
    };
    const syncService = { syncLetterboxdUser: vi.fn() };

    await expect(
      ensureLocalUser('ghost', { users, syncService, autoSyncIfMissing: false }),
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

    await expect(ensureLocalUser('ghost', { users, syncService })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
