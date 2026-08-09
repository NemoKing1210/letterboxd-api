import { createApp } from './app/server';
import { getContainer } from './app/container';

/** Bun.serve default is 10s; first page enrichment can exceed that. Max allowed: 255. */
const BUN_IDLE_TIMEOUT_SEC = 255;

const container = getContainer();
const app = createApp(container);

const port = container.env.PORT;

export default {
  port,
  fetch: app.fetch,
  idleTimeout: BUN_IDLE_TIMEOUT_SEC,
};

container.logger.info({ port, idleTimeoutSec: BUN_IDLE_TIMEOUT_SEC }, 'Letterboxd API listening');
