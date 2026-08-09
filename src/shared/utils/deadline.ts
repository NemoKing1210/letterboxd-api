/** Soft deadline so work stops before the platform kills the function. */
export type Deadline = {
  readonly budgetMs: number;
  readonly startedAt: number;
  readonly deadlineAt: number;
  remainingMs: () => number;
  isExpired: () => boolean;
};

export function createDeadline(budgetMs: number, nowMs: number = Date.now()): Deadline {
  const startedAt = nowMs;
  const deadlineAt = startedAt + Math.max(0, budgetMs);
  return {
    budgetMs,
    startedAt,
    deadlineAt,
    remainingMs: () => deadlineAt - Date.now(),
    isExpired: () => Date.now() >= deadlineAt,
  };
}

/**
 * Resolve how long a single serverless/local request may spend on scrape/enrichment.
 * - Explicit `REQUEST_BUDGET_MS` wins.
 * - On Vercel, default to headroom under the configured function maxDuration (300s → 270s).
 * - Locally, undefined (no artificial cap; Bun idleTimeout still applies).
 */
export function resolveRequestBudgetMs(options: {
  requestBudgetMs?: number;
  /** Vercel sets `VERCEL=1`. */
  isVercel?: boolean;
  /** Match `vercel.json` functions.maxDuration (seconds). */
  vercelMaxDurationSeconds?: number;
}): number | undefined {
  if (options.requestBudgetMs !== undefined && options.requestBudgetMs > 0) {
    return options.requestBudgetMs;
  }
  if (options.isVercel) {
    const maxSeconds = options.vercelMaxDurationSeconds ?? 300;
    // Leave headroom for JSON serialization and platform overhead.
    return Math.max(5_000, maxSeconds * 1000 - 30_000);
  }
  return undefined;
}
