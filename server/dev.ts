import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'node:path';
import { installConsoleCapture } from './monitoring/log-buffer';
import { buildApp } from './app';
import { publicSite } from './public/router';
import { AUTHOR_IS_PLACEHOLDER } from './public/config';
import { hostPublico } from './origem-publica';

// Captura console.* em ring buffer ANTES de qualquer log do app
installConsoleCapture();

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
      c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    }
    if (!c.res.headers.has('X-Content-Type-Options')) {
      c.header('X-Content-Type-Options', 'nosniff');
    }
  });

  // /api/* -> API (Hono inteiro com basePath '/api')
  root.all('/api/*', (c) => api.fetch(c.req.raw));

  // SEO básico: robots.txt e sitemap.xml (públicos)
  root.get('/robots.txt', (c) => {
    const host = c.req.header('host') ?? hostPublico();
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
      'Allow: /catalogo',
      `Sitemap: ${proto}://${host}/sitemap.xml`,
    ].join('\n');
    return c.text(body, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  });

  root.get('/sitemap.xml', async (c) => {
    const host = c.req.header('host') ?? hostPublico();
    const proto = c.req.header('x-forwarded-proto') ?? 'https';
    const base = `${proto}://${host}`;
    const today = new Date().toISOString().slice(0, 10);

    const staticUrls = [
      { path: '/', priority: '1.0', changefreq: 'weekly' },
      { path: '/formacoes', priority: '0.9', changefreq: 'weekly' },
      { path: '/blog', priority: '0.8', changefreq: 'weekly' },
      { path: '/sobre', priority: '0.6', changefreq: 'monthly' },
      // /autor sai do sitemap enquanto o responsável técnico for placeholder —
      // a rota devolve 404 nesse caso (ver server/public/config.ts).
      ...(AUTHOR_IS_PLACEHOLDER
        ? []
        : [{ path: '/autor', priority: '0.6', changefreq: 'monthly' }]),
      { path: '/contato', priority: '0.5', changefreq: 'monthly' },
      { path: '/termos', priority: '0.3', changefreq: 'yearly' },
      { path: '/privacidade', priority: '0.3', changefreq: 'yearly' },
    ];

    // Páginas públicas de curso e blog (via projeção pública — mesmos slugs/gate).
    let dynamicUrls: Array<{ path: string; priority: string; changefreq: string }> = [];
    try {
      const pub = await import('./public/projections');
      const [courses, posts] = await Promise.all([pub.listPublicCourses(), pub.listPublicPosts()]);
      dynamicUrls = [
        ...courses.map((co) => ({
          path: `/formacao/${co.slug}`,
          priority: '0.8',
          changefreq: 'weekly',
        })),
        ...posts.map((p) => ({
          path: `/blog/${p.slug}`,
          priority: '0.6',
          changefreq: 'monthly',
        })),
      ];
    } catch {
      /* ignore */
    }

    const allUrls = [...staticUrls, ...dynamicUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) =>
      `  <url><loc>${base}${u.path}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
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

  // ===== SITE PÚBLICO (SSR, sem auth) =====
  // Montado ANTES do static/SPA fallback: rotas públicas (/sobre, /autor,
  // /contato, ...) são servidas por SSR; qualquer outra rota cai no SPA logado.
  // Isolamento físico entre plano público e plano restrito (aluno/admin).
  root.route('/', publicSite);

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

  // 404 puro para /assets/* faltantes (chunks antigos pós-deploy):
  // SPA fallback retornaria HTML, mas o navegador recusa executar HTML como JS
  // (Content-Type mismatch + nosniff), causando 'error loading dynamically imported module'.
  // 404 dispara Vite a fazer fallback de import dinâmico, que o auto-reload captura.
  root.get('/assets/*', (c) => c.text('Not found', 404));

  // SPA fallback: qualquer GET não casado retorna index.html
  root.get('*', serveStatic({ path: 'index.html', root: staticRoot }));

  appToServe = root;
  // eslint-disable-next-line no-console
  console.log(`[ava-pco] modo full-stack (static + api)  static=${staticRoot}`);
} else {
  // Modo dev: o Vite serve o SPA em :5173 e faz proxy pra cá. Além da API,
  // montamos o site público SSR para que /formacao/:slug, /blog, /sobre etc.
  // respondam igual à produção — links <a href> do SPA pro plano público
  // (src/app/lib/publicUrls.ts) precisam resolver no dev também.
  const api = buildApp();
  const root = new Hono();
  root.all('/api/*', (c) => api.fetch(c.req.raw));
  root.route('/', publicSite);
  appToServe = root;
  // eslint-disable-next-line no-console
  console.log('[ava-pco] modo dev (/api + site público SSR)');
}

serve({ fetch: appToServe.fetch, port, hostname: process.env.HOST ?? '127.0.0.1' }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[ava-pco] http://${info.address}:${info.port}`);
});

// Worker de webhooks — processa entregas pendentes a cada 30s
import('./webhooks/dispatcher').then((m) => m.startWorker(30_000));

// Worker de reengajamento — varre alunos inativos uma vez por dia
import('./reengagement/worker').then((m) => m.startWorker(24 * 60 * 60_000));

// Seed de conexões de import pré-configuradas (idempotente)
import('./imports/seeds/portalpco').then((m) => m.seedPortalpcoConnection());

// Worker do scheduler de imports — varre a cada 60s
import('./imports/schedules-worker').then((m) => m.startWorker(60_000));

// Worker de digest diário admin — verifica a cada 30min se chegou a hora
import('./notifications/admin-digest').then((m) => m.startWorker());

// Worker de relatório semanal — verifica a cada 1h, dispara segunda 9h UTC default
import('./notifications/weekly-report').then((m) => m.startWorker());

// Worker de progresso semanal do aluno — verifica a cada 1h, dispara domingo 10h UTC default
import('./notifications/student-progress-email').then((m) => m.startWorker());

// Worker de backup automático — tick a cada 1h, dispara 1x/dia às 04h UTC
import('./db/backup-worker').then((m) => m.startWorker());

// Worker de recompute de risco de evasão — a cada 6h
import('./services/retention-worker').then((m) => m.startWorker(6 * 60 * 60 * 1000));

// Aviso de vencimento de acesso — varre uma vez por dia.
// Precisa estar no ar ANTES de qualquer curso declarar accessMonths: declarar
// meses é retroativo, e sem este worker a primeira leva de vencidos descobriria
// pela porta fechada. Ver docs/prazo-de-acesso.md.
import('./access/expiry-worker').then((m) => m.startWorker(24 * 60 * 60_000));

// Lembrete de sessão — tick de 15 min, e não diário: a faixa de 1 hora antes
// precisa de resolução melhor que um dia para existir de verdade.
import('./sessions/lembrete-worker').then((m) => m.startWorker(15 * 60_000));

// Rotaciona app.log quando passa de 10MB (verifica a cada 1h)
import('./services/log-rotator').then((m) => m.startWorker(60 * 60_000));

// Medição de tráfego: descarrega o que está em memória antes de o processo
// morrer. Sem isto, todo `pm2 restart` joga fora até 5 segundos de contagem —
// pouco, mas é exatamente o tipo de perda silenciosa que faz um número não
// fechar com o outro e ninguém saber por quê.
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(sinal, () => {
    void import('./analytics/collector')
      .then((m) => m.flush())
      .finally(() => process.exit(0));
  });
}
