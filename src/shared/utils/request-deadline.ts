import { AsyncLocalStorage } from 'node:async_hooks';
import type { Deadline } from './deadline';

const storage = new AsyncLocalStorage<Deadline>();

/** Run `fn` with a request-scoped soft deadline (scraper / enrichment consult it). */
export function runWithDeadline<T>(deadline: Deadline, fn: () => T): T {
  return storage.run(deadline, fn);
}

export function getRequestDeadline(): Deadline | undefined {
  return storage.getStore();
}
