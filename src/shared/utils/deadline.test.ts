import { describe, expect, it } from 'vitest';
import { createDeadline, resolveRequestBudgetMs } from './deadline';
import { movieFieldsNeedEnrichment, runWithDeadline } from './index';

describe('createDeadline', () => {
  it('tracks expiry against wall clock', () => {
    const active = createDeadline(60_000);
    expect(active.isExpired()).toBe(false);
    expect(active.remainingMs()).toBeGreaterThan(0);

    const expired = createDeadline(0);
    expect(expired.isExpired()).toBe(true);
  });
});

describe('resolveRequestBudgetMs', () => {
  it('prefers explicit REQUEST_BUDGET_MS', () => {
    expect(resolveRequestBudgetMs({ requestBudgetMs: 12_000, isVercel: true })).toBe(12_000);
  });

  it('defaults on Vercel with headroom under maxDuration', () => {
    expect(resolveRequestBudgetMs({ isVercel: true, vercelMaxDurationSeconds: 300 })).toBe(270_000);
    expect(resolveRequestBudgetMs({ isVercel: true, vercelMaxDurationSeconds: 60 })).toBe(30_000);
  });

  it('has no default budget off Vercel', () => {
    expect(resolveRequestBudgetMs({ isVercel: false })).toBeUndefined();
  });
});

describe('movieFieldsNeedEnrichment', () => {
  it('needs enrichment when fields omitted or include metadata keys', () => {
    expect(movieFieldsNeedEnrichment(undefined)).toBe(true);
    expect(movieFieldsNeedEnrichment(['title', 'genres'])).toBe(true);
    expect(movieFieldsNeedEnrichment(['title', 'year', 'rating'])).toBe(false);
  });
});

describe('runWithDeadline', () => {
  it('propagates store to nested work', async () => {
    const deadline = createDeadline(60_000);
    await runWithDeadline(deadline, async () => {
      const { getRequestDeadline } = await import('./request-deadline');
      expect(getRequestDeadline()?.budgetMs).toBe(60_000);
    });
  });
});
