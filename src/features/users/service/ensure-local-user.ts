import type { User } from '@prisma/client';
import type { SyncHistoryRepository, UserRepository } from '../../../infrastructure/database';
import type { AppLogger } from '../../../infrastructure/logger';
import { NotFoundError } from '../../../shared/errors/app-error';
import { normalizeUsername, scheduleBackground } from '../../../shared/utils';

/** Narrow sync port so feature services do not depend on SynchronizationService concrete. */
export type UserSyncTrigger = {
  syncLetterboxdUser(username: string): Promise<unknown>;
  /** Start sync without awaiting completion; returns SyncHistory id. */
  startBackgroundSync(username: string): Promise<{ syncId: string }>;
};

export type EnsureLocalUserDeps = {
  users: UserRepository;
  syncService: UserSyncTrigger;
  syncHistory: SyncHistoryRepository;
  /** Max age of last successful sync before re-sync. 0 disables stale refresh. */
  userSyncTtlSeconds: number;
  /** Default true: scrape + persist when the user is absent locally. */
  autoSyncIfMissing?: boolean;
  logger?: Pick<AppLogger, 'warn'>;
  /** Injectable clock for tests. */
  now?: () => Date;
};

/**
 * Resolve a local user, optionally triggering Letterboxd sync when missing or stale.
 * Missing user: awaits a full scrape (first request is slow) unless callers use async first-sync.
 * Stale user: kicks off a background refresh and returns local data immediately.
 */
export async function ensureLocalUser(
  username: string,
  deps: EnsureLocalUserDeps,
): Promise<User> {
  const normalized = normalizeUsername(username);
  let user = await deps.users.findByUsername(normalized);

  if (!user && deps.autoSyncIfMissing !== false) {
    await deps.syncService.syncLetterboxdUser(normalized);
    user = await deps.users.findByUsername(normalized);
  }

  if (!user) {
    throw new NotFoundError(`User "${normalized}" not found`);
  }

  if (deps.userSyncTtlSeconds > 0 && (await isUserDataStale(normalized, deps))) {
    scheduleBackground(
      deps.syncService.syncLetterboxdUser(normalized).catch((error) => {
        deps.logger?.warn(
          { err: error, username: normalized },
          'Stale user sync failed; serving local data',
        );
      }),
    );
  }

  return user;
}

async function isUserDataStale(username: string, deps: EnsureLocalUserDeps): Promise<boolean> {
  const latest = await deps.syncHistory.findLatestSuccessful(username);
  if (!latest?.finishedAt) {
    return true;
  }

  const now = deps.now?.() ?? new Date();
  const ageMs = now.getTime() - latest.finishedAt.getTime();
  return ageMs > deps.userSyncTtlSeconds * 1000;
}
