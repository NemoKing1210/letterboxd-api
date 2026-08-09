import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison. Returns false when lengths differ
 * (after a dummy compare to reduce length-oracle signal).
 */
export function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');

  if (leftBuf.length !== rightBuf.length) {
    const dummy = Buffer.alloc(leftBuf.length);
    timingSafeEqual(leftBuf, dummy);
    return false;
  }

  return timingSafeEqual(leftBuf, rightBuf);
}

export function timingSafeIncludes(candidates: readonly string[], value: string): boolean {
  let matched = false;
  for (const candidate of candidates) {
    if (timingSafeEqualString(candidate, value)) {
      matched = true;
    }
  }
  return matched;
}
