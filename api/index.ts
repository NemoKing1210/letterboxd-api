import { handle } from '@hono/node-server/vercel';
import { createApp } from '../src/app/server';
import { getContainer } from '../src/app/container';

const container = getContainer();
const app = createApp(container);

export default handle(app);
