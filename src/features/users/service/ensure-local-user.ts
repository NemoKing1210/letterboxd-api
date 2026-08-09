import type { User } from '@prisma/client';
import type { UserRepository } from '../../../infrastructure/database';
import { NotFoundError } from '../../../shared/errors/app-error';
import { normalizeUsername } from '../../../shared/utils';

/** Narrow sync port so feature services do not depend on SynchronizationService concrete. */
export type UserSyncTrigger = {
  syncLetterboxdUser(username: string): Promise<unknown>;
};

export type EnsureLocalUserDeps = {
  users: UserRepository;
  syncService: UserSyncTrigger;
  /** Default true: scrape + persist when the user is absent locally. */
  autoSyncIfMissing?: boolean;
};

/**
 * Resolve a local user, optionally triggering Letterboxd sync when missing.
 * First request for an unknown username may take longer (full scrape).
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

  return user;
}
