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

  // Security headers em toda response (HTML + assets + uploads + API)
  // CSP, HSTS, X-Frame, Permissions-Policy
  root.use('*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Content-Security-Policy')) {
      c.header(
        'Content-Security-Policy',
        "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "img-src 'self' data: blob: https:; " +
          "font-src 'self' https://fonts.gstatic.com data:; " +
          "connect-src 'self' https:; " +
          "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    }
    if (!c.res.headers.has('Strict-Transport-Security')) {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (!c.res.headers.has('X-Frame-Options')) {
      c.header('X-Frame-Options', 'DENY');
    }
    if (!c.res.headers.has('Referrer-Policy')) {
      c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    if (!c.res.headers.has('Permissions-Policy')) {
      c.header(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=()',
      );
    }
    if (!c.res.headers.has('X-Content-Type-Options')) {
      c.header('X-Content-Type-Options', 'nosniff');
    }
  });

  // /api/* -> API (Hono inteiro com basePath '/api')
  root.all('/api/*', (c) => api.fetch(c.req.raw));

  // SEO básico: robots.txt e sitemap.xml (públicos)
  root.get('/robots.txt', (c) => {
    const host = c.req.header('host') ?? 'ava.psicanaliseclinica.online';
    const proto = c.req.header('x-forwarded-proto') ?? 'https';
    const body = [
      'User-agent: *',
      'Disallow: /admin/',
      'Disallow: /api/',
      'Disallow: /dashboard',
      'Disallow: /perfil',
      'Disallow: /jornada',
      'Disallow: /cursos',
      'Disallow: /biblioteca',
      'Disallow: /podcasts',
      'Disallow: /tutor',
      'Disallow: /certificados',
      'Disallow: /suporte',
      'Allow: /verificar/',
      'Allow: /termos',
      'Allow: /privacidade',
      `Sitemap: ${proto}://${host}/sitemap.xml`,
    ].join('\n');
    return c.text(body, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  });

  root.get('/sitemap.xml', (c) => {
    const host = c.req.header('host') ?? 'ava.psicanaliseclinica.online';
    const proto = c.req.header('x-forwarded-proto') ?? 'https';
    const base = `${proto}://${host}`;
    const today = new Date().toISOString().slice(0, 10);
    const urls = ['/', '/login', '/landing', '/termos', '/privacidade', '/esqueci-senha'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq></url>`,
  )
  .join('\n')}
</urlset>`;
    return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  });

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
