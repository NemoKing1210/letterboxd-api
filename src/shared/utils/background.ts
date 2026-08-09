/**
 * Keep async work alive after the HTTP response on Vercel (`waitUntil`).
 * Locally / elsewhere: fire-and-forget (promise still runs while the process is up).
 */
export function scheduleBackground(work: Promise<unknown>): void {
  if (process.env.VERCEL) {
    void import('@vercel/functions')
      .then(({ waitUntil }) => {
        waitUntil(work);
      })
      .catch(() => {
        void work;
      });
    return;
  }
  void work;
}
