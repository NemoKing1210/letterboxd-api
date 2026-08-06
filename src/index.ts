import { createApp } from './app/server';
import { getContainer } from './app/container';

const container = getContainer();
const app = createApp(container);

const port = container.env.PORT;

export default {
  port,
  fetch: app.fetch,
};

container.logger.info({ port }, 'Letterboxd Intelligence API listening');
