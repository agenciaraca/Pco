import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'node:path';
import { buildApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const staticRoot = process.env.SERVE_STATIC; // ex.: "./dist"
const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

let appToServe;

if (staticRoot) {
  const root = new Hono();
  const api = buildApp();

  // /api/* -> API (Hono inteiro com basePath '/api')
  root.all('/api/*', (c) => api.fetch(c.req.raw));

  // /uploads/* -> arquivos persistidos pelos usuários (data/uploads/)
  // Cache curto (1h) para permitir invalidação simples
  root.use('/uploads/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=3600');
  });
  root.use('/uploads/*', serveStatic({ root: path.relative(process.cwd(), dataDir) || '.' }));

  // Cache control: /assets/* é imutável (hash no nome), index.html nunca cacheia
  root.use('/*', async (c, next) => {
    await next();
    const p = c.req.path;
    if (p.startsWith('/assets/')) {
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (p === '/' || p.endsWith('.html')) {
      c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      c.header('Pragma', 'no-cache');
    }
  });

  // Arquivos estáticos (favicon, assets/*, etc.)
  root.use('/*', serveStatic({ root: staticRoot }));

  // SPA fallback: qualquer GET não casado retorna index.html
  root.get('*', serveStatic({ path: 'index.html', root: staticRoot }));

  appToServe = root;
  // eslint-disable-next-line no-console
  console.log(`[ava-pco] modo full-stack (static + api)  static=${staticRoot}`);
} else {
  appToServe = buildApp();
  // eslint-disable-next-line no-console
  console.log('[ava-pco] modo dev (apenas /api)');
}

serve({ fetch: appToServe.fetch, port, hostname: process.env.HOST ?? '127.0.0.1' }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[ava-pco] http://${info.address}:${info.port}`);
});
