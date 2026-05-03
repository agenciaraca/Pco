import { handle } from 'hono/vercel';
import { buildApp } from '../server/app';

export const config = { runtime: 'nodejs' };

const app = buildApp();

export default handle(app);
