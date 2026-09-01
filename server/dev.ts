import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'node:path';
import { installConsoleCapture } from './monitoring/log-buffer';
import { buildApp } from './app';
import { publicSite } from './public/router';
import { getTags, hostsParaCsp } from './marketing/tags-store';
import { ROTAS_FUNDIDAS } from './public/rotas-fundidas';
import { montarCsp } from './public/csp';
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
      // A política mora em `public/csp.ts`, com os porquês — inclusive o do
      // `frame-src`, que faltava e fazia o site bloquear o próprio player.
      c.header('Content-Security-Policy', montarCsp(hostsParaCsp()));
    }
    // HSTS **sem** `includeSubDomains` desde 30/ago/2026, e isso é temporário.
    //
    // Enquanto o AVA respondia só em `ava.`, incluir os subdomínios não custava
    // nada. Servindo o domínio principal, a diretiva passa a valer para *todos*
    // os subdomínios — inclusive `old.`, que hospeda a loja e ainda não tem
    // certificado válido. O efeito é brutal e silencioso: quem abre o site
    // principal fica um ano sem conseguir acessar a loja, e o navegador não
    // oferece "continuar assim mesmo" — HSTS não tem escapatória por clique.
    //
    // Ligar de volta assim que `old.psicanaliseclinica.online` tiver
    // certificado próprio. A troca é sentida por quem revisitar o site
    // principal, porque a política é substituída a cada visita.
    if (!c.res.headers.has('Strict-Transport-Security')) {
      const comSubdominios = process.env.HSTS_INCLUDE_SUBDOMAINS === 'true';
      c.header(
        'Strict-Transport-Security',
        `max-age=31536000${comSubdominios ? '; includeSubDomains' : ''}`,
      );
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

  // Endereço canônico: um domínio responde, os outros apontam para ele.
  //
  // O AVA atende hoje por mais de um nome (`ava.`, `www.` e o principal). Sem
  // isso, o buscador encontra a mesma página em três endereços e trata como
  // conteúdo duplicado — e o `<link rel="canonical">`, que já sai apontando
  // para `PUBLIC_ORIGIN`, contradiz a URL que a pessoa está vendo.
  //
  // Vem **depois** de `/api/*` de propósito: redirecionar a API quebraria
  // integração. Um 301 num POST faz parte dos clientes reenviar como GET e
  // perder o corpo — quem consome a API pública passa a receber erro sem
  // entender por quê. A API responde por qualquer um dos nomes.
  //
  // Só age quando há para onde ir e o nome é diferente, então em
  // desenvolvimento (sem `PUBLIC_ORIGIN`) não redireciona nada.
  root.use('*', async (c, next) => {
    const canonico = process.env.PUBLIC_ORIGIN?.trim();
    if (!canonico) return next();

    let hostCanonico: string;
    try {
      hostCanonico = new URL(canonico).host;
    } catch {
      // Origem malformada não pode derrubar o site inteiro num redirecionamento
      // para lugar nenhum: segue sem redirecionar.
      return next();
    }

    const host = c.req.header('host');
    if (!host || host === hostCanonico) return next();

    const url = new URL(c.req.url);
    return c.redirect(`${canonico}${url.pathname}${url.search}`, 301);
  });

  /**
   * Rotas antigas que passaram a ter um dono único (30/ago/2026).
   *
   * O produto tinha a mesma página em dois lugares: a lista de cursos existia
   * em `/formacoes` (servidor) e `/catalogo` (aplicativo), e a página inicial
   * respondia em três endereços. Duas implementações do mesmo assunto sempre
   * divergem — e divergiram: cartões diferentes, ordem de informação diferente,
   * preço em destaque diferente.
   *
   * 301 e não 302: é mudança definitiva, e é o que faz o buscador transferir o
   * histórico da URL antiga para a nova em vez de tratar as duas como páginas
   * concorrentes. Link salvo, anúncio antigo e resultado de busca continuam
   * funcionando.
   *
   * `/comparar` some porque nenhum link do produto apontava para ela; a
   * comparação volta como seleção nos cartões da própria lista.
   */
  for (const [de, para] of Object.entries(ROTAS_FUNDIDAS)) {
    root.get(de, (c) => c.redirect(para, 301));
  }

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
      'Allow: /ava-pco',
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
      // Destino do menu desde 30/ago/2026 ("Nosso AVA"): apresenta o ambiente
      // a quem ainda não comprou, e por isso pertence ao sitemap.
      { path: '/ava-pco', priority: '0.7', changefreq: 'monthly' },
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

/**
 * Aquece o cache das tags antes de servir a primeira página.
 *
 * O middleware de CSP e o `<head>` leem a configuração de forma síncrona — não
 * dá para esperar disco a cada requisição. Sem este aquecimento, a primeira
 * página servida após um restart sairia sem as metas de verificação.
 */
void getTags();

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

// Sondagem das cobranças da Sandra a cada 5 min — é assim que o pagamento é
// confirmado enquanto o aviso de volta dela não existe. Intervalo em minutos,
// como a documentação dela pede; sem gateway Sandra cadastrado, não faz nada.
import('./payments/sandra-poll-worker').then((m) => m.startWorker(5 * 60_000));

// Rotaciona app.log quando passa de 10MB (verifica a cada 1h)
import('./services/log-rotator').then((m) => m.startWorker(60 * 60_000));

// Medição de tráfego: descarrega o que está em memória antes de o processo
// morrer. Sem isto, todo `pm2 restart` joga fora até 5 segundos de contagem —
// pouco, mas é exatamente o tipo de perda silenciosa que faz um número não
// fechar com o outro e ninguém saber por quê.
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(sinal, () => {
    void import('./analytics/collector').then((m) => m.flush()).finally(() => process.exit(0));
  });
}
