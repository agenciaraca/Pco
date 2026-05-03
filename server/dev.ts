import { serve } from '@hono/node-server';
import { buildApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const app = buildApp();

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[api] running on http://localhost:${info.port}`);
});
