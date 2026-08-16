/**
 * Router do SITE PÚBLICO (plano público — SEM auth). Montado em server/dev.ts
 * ANTES do fallback do SPA. Só lê dados pela camada de projeção (projections.ts),
 * nunca toca repos de aluno/admin. Isolamento físico: público aqui, restrito lá.
 *
 * Sprint 1: institucional sem colisão (/sobre, /autor, /contato) + asset JS.
 * Próximas sprints adicionam /cursos, /curso/:slug, /blog, /carrinho, /checkout, /.
 */
import { Hono } from 'hono';
import { html, raw } from 'hono/html';
import { ORG, AUTHOR, AUTHOR_IS_PLACEHOLDER, YMYL_DISCLAIMER } from './config';
import { renderPage } from './layout';
import {
  orgJsonLd,
  websiteJsonLd,
  personJsonLd,
  breadcrumbJsonLd,
  contactPageJsonLd,
  aboutPageJsonLd,
  blogJsonLd,
  blogPostingJsonLd,
  courseJsonLd,
  faqJsonLd,
} from './jsonld';
import {
  listPublicPosts,
  getPublicPostBySlug,
  listPublicCourses,
  getPublicCourseBySlug,
  getPublicCourseSlugById,
} from './projections';
import { PUBLIC_JS } from './client';

/** Data pt-BR legível a partir de ISO. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const publicSite = new Hono();

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' } as const;

// ---- asset JS same-origin (CSP script-src 'self') ----
publicSite.get('/_pub/site.js', (c) => {
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(PUBLIC_JS);
});

// ---- redirect 301 de URLs antigas (id) p/ as amigáveis (slug), p/ SEO ----
publicSite.get('/curso-preview/:id', async (c) => {
  const slug = await getPublicCourseSlugById(c.req.param('id'));
  return c.redirect(slug ? `/formacao/${slug}` : '/formacoes', 301);
});

// ---- /llms.txt (padrão llmstxt.org) — Markdown c/ H1 + links, p/ GEO/LLM ----
publicSite.get('/llms.txt', async (c) => {
  const [courses, posts] = await Promise.all([listPublicCourses(), listPublicPosts()]);
  const u = (p: string) => ORG.url + p;
  const lines: string[] = [];
  lines.push(`# ${ORG.name}`);
  lines.push('');
  lines.push(
    `> Formação livre em psicanálise clínica online desde ${ORG.founded}. Cursos estruturados, no seu ritmo, com certificado digital e ${ORG.rntp}. Não substitui graduação em Psicologia ou Medicina.`,
  );
  lines.push('');
  lines.push(
    'A PCO é um ambiente de aprendizagem (LMS) focado em psicanálise clínica e áreas afins. Conteúdo educacional YMYL (saúde mental) revisado eticamente por responsável técnico identificado.',
  );
  lines.push('');
  lines.push('## Páginas principais');
  lines.push(`- [Início](${u('/')}): apresentação da PCO e das formações.`);
  lines.push(`- [Formações](${u('/formacoes')}): catálogo de cursos de psicanálise clínica.`);
  lines.push(`- [Blog](${u('/blog')}): artigos sobre psicanálise, formação e carreira.`);
  lines.push(`- [Sobre](${u('/sobre')}): missão, método e credibilidade da PCO.`);
  if (!AUTHOR_IS_PLACEHOLDER) {
    lines.push(`- [Responsável técnico](${u('/autor')}): perfil, credenciais e autoria (E-E-A-T).`);
  }
  lines.push(`- [Contato](${u('/contato')}): canais de atendimento.`);
  if (courses.length) {
    lines.push('');
    lines.push('## Formações');
    for (const co of courses) {
      const d = (co.tagline || co.description || '').slice(0, 120);
      lines.push(`- [${co.title}](${u('/formacao/' + co.slug)})${d ? ': ' + d : ''}`);
    }
  }
  if (posts.length) {
    lines.push('');
    lines.push('## Artigos recentes');
    for (const p of posts.slice(0, 15)) {
      lines.push(
        `- [${p.title}](${u('/blog/' + p.slug)})${p.excerpt ? ': ' + p.excerpt.slice(0, 120) : ''}`,
      );
    }
  }
  lines.push('');
  c.header('Content-Type', 'text/plain; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(lines.join('\n'));
});

// ============================ /sobre ============================
publicSite.get('/sobre', async (c) => {
  const body = html`
    <section class="section-tight hero-deep">
      <div class="wrap">
        <nav class="breadcrumb" aria-label="Trilha" style="color:#9fc0ba">
          <a href="/">Início</a><span>›</span><span>Sobre</span>
        </nav>
        <span class="eyebrow">Sobre a ${ORG.shortName}</span>
        <h1 style="margin:14px 0 16px;max-width:20ch">
          Formação séria em psicanálise clínica, no seu ritmo
        </h1>
        <p class="lead" style="max-width:60ch">
          Desde ${ORG.founded}, ajudamos pessoas a estudar psicanálise com estrutura, ética e
          transparência — reconhecidos pela ${ORG.rntp}.
        </p>
      </div>
    </section>

    <section class="section">
      <div class="wrap two-col" style="align-items:start">
        <div class="prose">
          <h2>Nossa missão</h2>
          <p>
            Tornar o estudo da psicanálise clínica acessível e responsável: conteúdo estruturado dos
            fundamentos freudianos às abordagens contemporâneas, com clareza sobre o que uma
            formação livre é — e o que ela não é.
          </p>
          <h2>Como ensinamos</h2>
          <p>
            Percursos organizados por módulos, no seu ritmo, com certificado digital ao final. Cada
            curso é revisado eticamente e ancorado em referências consolidadas.
          </p>
          <ul>
            <li>Conteúdo progressivo, dos fundamentos à prática</li>
            <li>Estudo flexível — comece quando quiser, avance no seu tempo</li>
            <li>Responsável técnico identificado e credenciado</li>
            <li>Transparência sobre limites e ética da profissão</li>
          </ul>
        </div>
        <aside class="stack">
          <div class="card">
            <h3 style="margin-bottom:6px">Em números</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:12px">
              <div>
                <div style="font-size:30px;font-weight:800;color:var(--accent)">
                  <span data-count-to="2018">2018</span>
                </div>
                <div style="font-size:13px;color:var(--ink-soft)">no ar desde</div>
              </div>
              <div>
                <div style="font-size:30px;font-weight:800;color:var(--accent)">
                  <span data-count-to="1000">0</span>+
                </div>
                <div style="font-size:13px;color:var(--ink-soft)">alunos formados</div>
              </div>
              <div>
                <div style="font-size:30px;font-weight:800;color:var(--accent)">
                  <span data-count-to="3">0</span>
                </div>
                <div style="font-size:13px;color:var(--ink-soft)">formações</div>
              </div>
              <div>
                <div style="font-size:30px;font-weight:800;color:var(--accent)">4,7</div>
                <div style="font-size:13px;color:var(--ink-soft)">avaliação média</div>
              </div>
            </div>
          </div>
          <div class="disclaimer">${YMYL_DISCLAIMER}</div>
          ${raw(
            AUTHOR_IS_PLACEHOLDER
              ? ''
              : '<a class="btn btn-primary" href="/autor" style="width:100%">Conheça o responsável técnico</a>',
          )}
        </aside>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `Sobre — ${ORG.name}`,
      description: `Quem é a ${ORG.shortName}: formação livre em psicanálise clínica desde ${ORG.founded}, com estrutura, ética e ${ORG.rntp}. Não substitui graduação em Psicologia ou Medicina.`,
      path: '/sobre',
      activeNav: 'sobre',
      bodyHtml: body,
      jsonLd: [
        orgJsonLd(),
        websiteJsonLd(),
        aboutPageJsonLd(),
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Sobre', path: '/sobre' },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /autor ============================
publicSite.get('/autor', async (c) => {
  // Sem responsável técnico real configurado, a página não existe. Publicar o
  // molde ("Dra. [Nome do Responsável Técnico]") com credenciais anexadas seria
  // atribuir formação em saúde mental a ninguém. Ver AUTHOR_IS_PLACEHOLDER.
  if (AUTHOR_IS_PLACEHOLDER) return c.notFound();
  const initials =
    AUTHOR.name
      .replace(/\[.*?\]/g, '')
      .trim()
      .slice(0, 1)
      .toUpperCase() || 'ψ';
  const body = html`
    <section class="section-tight">
      <div class="wrap">
        <nav class="breadcrumb" aria-label="Trilha">
          <a href="/">Início</a><span>›</span><span>Responsável técnico</span>
        </nav>
      </div>
    </section>
    <section class="section-tight">
      <div class="wrap two-col" style="align-items:start">
        <div class="stack">
          <div class="card" style="text-align:center">
            ${AUTHOR.photo
              ? raw(
                  `<img src="${AUTHOR.photo}" alt="${AUTHOR.name}" width="140" height="140" style="width:140px;height:140px;border-radius:50%;object-fit:cover;margin:0 auto 14px">`,
                )
              : raw(
                  `<div aria-hidden="true" style="width:140px;height:140px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;font-size:52px;font-weight:800;color:#fff;background:linear-gradient(135deg,#0a3f3a,#1f9e93)">${initials}</div>`,
                )}
            <h1 style="font-size:24px">${AUTHOR.name}</h1>
            <p style="color:var(--ink-soft);font-size:14.5px;margin-top:4px">${AUTHOR.honorific}</p>
            <div
              style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap"
            >
              ${raw(
                AUTHOR.sameAs
                  .map(
                    (u) =>
                      `<a class="tag-chip" href="${u}" rel="noopener nofollow me">${new URL(u).hostname.replace('www.', '')}</a>`,
                  )
                  .join(''),
              )}
            </div>
          </div>
          <div class="card">
            <h3 style="font-size:15px;margin-bottom:10px">Credenciais</h3>
            <ul
              style="list-style:none;padding:0;margin:0;display:grid;gap:9px;font-size:14px;color:var(--ink-soft)"
            >
              ${raw(
                AUTHOR.credentials
                  .map(
                    (cr) =>
                      `<li style="display:flex;gap:9px"><span style="color:var(--accent)">✓</span><span>${cr}</span></li>`,
                  )
                  .join(''),
              )}
            </ul>
          </div>
        </div>
        <div class="prose">
          <span class="eyebrow">Experiência &amp; expertise</span>
          <h2 style="margin:14px 0 16px">Quem assina a curadoria dos cursos</h2>
          <p>${AUTHOR.bio}</p>
          <p>${AUTHOR.experience}</p>
          <div class="disclaimer" style="margin-top:20px">${YMYL_DISCLAIMER}</div>
        </div>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `${AUTHOR.name} — Responsável técnico | ${ORG.shortName}`,
      description: `${AUTHOR.name}, ${AUTHOR.jobTitle} da ${ORG.shortName}. ${AUTHOR.bio.slice(0, 120)}`,
      path: '/autor',
      ogType: 'profile',
      bodyHtml: body,
      jsonLd: [
        personJsonLd(),
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Responsável técnico', path: '/autor' },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /contato ============================
publicSite.get('/contato', async (c) => {
  const body = html`
    <section class="section-tight hero-deep">
      <div class="wrap">
        <nav class="breadcrumb" aria-label="Trilha" style="color:#9fc0ba">
          <a href="/">Início</a><span>›</span><span>Contato</span>
        </nav>
        <span class="eyebrow">Fale com a ${ORG.shortName}</span>
        <h1 style="margin:14px 0 12px">Estamos por aqui para ajudar</h1>
        <p class="lead" style="max-width:52ch">
          Dúvidas sobre os cursos, matrícula ou acesso? Escolha o canal que preferir.
        </p>
      </div>
    </section>
    <section class="section">
      <div class="wrap three-col">
        <a class="card" href="${ORG.whatsapp}" rel="noopener nofollow" style="text-align:center">
          <div style="font-size:34px">💬</div>
          <h3 style="font-size:17px;margin:8px 0 4px">WhatsApp</h3>
          <p style="color:var(--ink-soft);font-size:14px">${ORG.phones[0]}</p>
        </a>
        <a class="card" href="mailto:${ORG.email}" style="text-align:center">
          <div style="font-size:34px">✉️</div>
          <h3 style="font-size:17px;margin:8px 0 4px">E-mail</h3>
          <p style="color:var(--ink-soft);font-size:14px">${ORG.email}</p>
        </a>
        <div class="card" style="text-align:center">
          <div style="font-size:34px">📍</div>
          <h3 style="font-size:17px;margin:8px 0 4px">Endereço</h3>
          <p style="color:var(--ink-soft);font-size:14px">
            ${ORG.address.street}<br />${ORG.address.city} · ${ORG.address.region}
          </p>
        </div>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `Contato — ${ORG.shortName}`,
      description: `Fale com a ${ORG.shortName} por WhatsApp (${ORG.phones[0]}), e-mail (${ORG.email}) ou visite-nos em ${ORG.address.city}/${ORG.address.region}.`,
      path: '/contato',
      activeNav: 'contato',
      bodyHtml: body,
      jsonLd: [
        orgJsonLd(),
        contactPageJsonLd(),
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Contato', path: '/contato' },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ helpers blog ============================
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================ /blog ============================
publicSite.get('/blog', async (c) => {
  const posts = await listPublicPosts();
  const [featured, ...rest] = posts;
  const card = (p: (typeof posts)[number], big = false): string => `
    <a class="card" href="/blog/${p.slug}" style="display:block${big ? ';grid-column:1/-1' : ''}">
      <div aria-hidden="true" style="height:8px;border-radius:6px;background:${esc(p.coverColor || 'var(--accent)')};margin:-6px -6px 16px"></div>
      ${p.category ? `<span class="tag-chip">${esc(p.category)}</span>` : ''}
      <h3 style="font-size:${big ? 22 : 18}px;margin:10px 0 8px">${esc(p.title)}</h3>
      <p style="color:var(--ink-soft);font-size:14.5px">${esc(p.excerpt.slice(0, big ? 220 : 120))}${p.excerpt.length > (big ? 220 : 120) ? '…' : ''}</p>
      <p style="color:var(--ink-faint);font-size:12.5px;margin-top:14px">${esc(p.authorName)} · ${fmtDate(p.publishedAt)} · ${p.readingMinutes} min de leitura</p>
    </a>`;
  const body = html`
    <section class="section-tight hero-deep">
      <div class="wrap">
        <nav class="breadcrumb" aria-label="Trilha" style="color:#9fc0ba">
          <a href="/">Início</a><span>›</span><span>Blog</span>
        </nav>
        <span class="eyebrow">Blog da ${ORG.shortName}</span>
        <h1 style="margin:14px 0 12px">Artigos sobre psicanálise clínica</h1>
        <p class="lead" style="max-width:56ch">
          Fundamentos, carreira e prática — conteúdo honesto para quem estuda ou pensa em estudar
          psicanálise.
        </p>
      </div>
    </section>
    <section class="section">
      <div class="wrap">
        <div class="three-col">
          ${raw(featured ? card(featured, true) : '')} ${raw(rest.map((p) => card(p)).join(''))}
        </div>
        ${posts.length === 0
          ? raw('<p style="color:var(--ink-soft)">Nenhum artigo publicado ainda.</p>')
          : ''}
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `Blog — ${ORG.name}`,
      description: `Artigos sobre psicanálise clínica, formação e carreira pela ${ORG.shortName}. Conteúdo honesto sobre estudar e atuar em psicanálise.`,
      path: '/blog',
      activeNav: 'blog',
      bodyHtml: body,
      jsonLd: [
        blogJsonLd(posts),
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Blog', path: '/blog' },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /blog/:slug ============================
publicSite.get('/blog/:slug', async (c) => {
  const post = await getPublicPostBySlug(c.req.param('slug'));
  if (!post) {
    const nf = html`
      <section class="section" style="text-align:center">
        <div class="wrap">
          <h1>Artigo não encontrado</h1>
          <p class="lead" style="margin:12px 0 24px">
            O texto que você procura pode ter sido movido.
          </p>
          <a class="btn btn-primary" href="/blog">Ver todos os artigos</a>
        </div>
      </section>
    `;
    return c.html(
      renderPage({
        title: `Artigo não encontrado — ${ORG.shortName}`,
        description: 'Artigo não encontrado.',
        path: `/blog/${c.req.param('slug')}`,
        noindex: true,
        bodyHtml: nf,
      }),
      404,
      HTML_HEADERS,
    );
  }
  const tagsHtml = post.tags.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:24px 0">${post.tags
        .map((t) => `<span class="tag-chip">#${esc(t)}</span>`)
        .join('')}</div>`
    : '';
  const relatedHtml = post.relatedCourseSlugs.length
    ? `<div style="margin-top:28px"><h2 style="font-size:20px;margin-bottom:12px">Cursos relacionados</h2>${post.relatedCourseSlugs
        .map(
          (s) =>
            // /formacao/:slug (SSR público) — /curso/:id é a rota do aluno logado.
            `<a class="btn btn-outline" href="/formacao/${s}" style="margin:0 8px 8px 0">Ver curso</a>`,
        )
        .join('')}</div>`
    : '';
  const body = html`
    <article>
      <section class="section-tight">
        <div class="wrap" style="max-width:760px">
          <nav class="breadcrumb" aria-label="Trilha">
            <a href="/">Início</a><span>›</span><a href="/blog">Blog</a><span>›</span
            ><span>${post.category ?? 'Artigo'}</span>
          </nav>
          ${post.category ? raw(`<span class="tag-chip">${esc(post.category)}</span>`) : ''}
          <h1 style="margin:14px 0 12px">${post.title}</h1>
          <p class="lead">${post.excerpt}</p>
          <p style="color:var(--ink-faint);font-size:13px;margin-top:16px">
            Por
            ${raw(
              AUTHOR_IS_PLACEHOLDER
                ? esc(post.authorName)
                : `<a href="/autor" style="color:var(--accent)">${esc(post.authorName)}</a>`,
            )}
            · ${raw(fmtDate(post.publishedAt))} · ${post.readingMinutes} min de leitura
          </p>
        </div>
      </section>
      <section style="padding-bottom:32px">
        <div class="wrap prose" style="max-width:760px">
          <div class="disclaimer" style="margin-bottom:24px">
            <strong>Em resumo:</strong> ${post.excerpt}
          </div>
          ${raw(post.bodyHtml)} ${raw(tagsHtml)}
          <div class="card" style="margin-top:28px;display:flex;gap:16px;align-items:center">
            <div
              aria-hidden="true"
              style="width:56px;height:56px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,#0a3f3a,#1f9e93)"
            ></div>
            <div>
              <div style="font-weight:700">${esc(post.authorName)}</div>
              ${raw(
                AUTHOR_IS_PLACEHOLDER
                  ? ''
                  : '<a href="/autor" style="color:var(--accent);font-size:14px">Conheça o responsável técnico →</a>',
              )}
            </div>
          </div>
          <div class="disclaimer" style="margin-top:20px">${YMYL_DISCLAIMER}</div>
          ${raw(relatedHtml)}
        </div>
      </section>
    </article>
  `;
  return c.html(
    renderPage({
      title: `${post.title} — ${ORG.shortName}`,
      description: post.excerpt.slice(0, 155),
      path: `/blog/${post.slug}`,
      ogType: 'article',
      activeNav: 'blog',
      bodyHtml: body,
      jsonLd: [
        blogPostingJsonLd(post),
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ / (Home) ============================
publicSite.get('/', async (c) => {
  const [courses, posts] = await Promise.all([listPublicCourses(), listPublicPosts()]);
  const courseCard = (co: (typeof courses)[number]): string => `
    <a class="card" href="/formacao/${co.slug}" style="display:block">
      <div aria-hidden="true" style="height:8px;border-radius:6px;background:${esc(co.coverColor || 'var(--accent)')};margin:-6px -6px 16px"></div>
      ${co.badge ? `<span class="tag-chip">${esc(co.badge)}</span>` : ''}
      <h3 style="font-size:19px;margin:10px 0 8px">${esc(co.shortTitle || co.title)}</h3>
      <p style="color:var(--ink-soft);font-size:14px">${esc((co.tagline || co.description || '').slice(0, 110))}</p>
      <p style="color:var(--ink);font-weight:800;margin-top:14px">${co.priceFormatted ? esc(co.priceFormatted) : 'Consulte'}${co.installmentFormatted ? ` <span style="font-weight:600;color:var(--ink-faint);font-size:13px">ou 12x ${esc(co.installmentFormatted)}</span>` : ''}</p>
    </a>`;
  const postCard = (p: (typeof posts)[number]): string => `
    <a class="card" href="/blog/${p.slug}" style="display:block">
      ${p.category ? `<span class="tag-chip">${esc(p.category)}</span>` : ''}
      <h3 style="font-size:17px;margin:10px 0 8px">${esc(p.title)}</h3>
      <p style="color:var(--ink-soft);font-size:14px">${esc(p.excerpt.slice(0, 100))}…</p>
      <p style="color:var(--ink-faint);font-size:12.5px;margin-top:12px">${p.readingMinutes} min de leitura</p>
    </a>`;
  const body = html`
    <section class="hero-deep" style="padding:clamp(56px,9vw,110px) 0">
      <div class="wrap" style="max-width:820px">
        <span class="eyebrow">Formação livre em psicanálise clínica · desde ${ORG.founded}</span>
        <h1 style="margin:18px 0 18px">Estude psicanálise clínica com seriedade, no seu ritmo</h1>
        <p class="lead" style="max-width:60ch">
          Percursos estruturados dos fundamentos freudianos às abordagens contemporâneas — com
          certificado digital, ética e o reconhecimento da ${ORG.rntp}.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px">
          <a class="btn btn-primary" href="/formacoes">Ver cursos</a>
          <a class="btn btn-wa" href="${ORG.whatsapp}" rel="noopener nofollow">Falar no WhatsApp</a>
        </div>
        <p style="color:#cfe0dc;font-size:13.5px;margin-top:22px">
          ★ 4,7/5 · centenas de alunos formados · ${ORG.rntp}
        </p>
      </div>
    </section>

    <section class="section-tight" style="background:var(--brand-deep)">
      <div class="wrap three-col" style="text-align:center;color:var(--on-deep)">
        <div>
          <div style="font-size:38px;font-weight:800"><span data-count-to="2018">2018</span></div>
          <div style="color:#cfe0dc;font-size:14px">no ar desde</div>
        </div>
        <div>
          <div style="font-size:38px;font-weight:800"><span data-count-to="1000">0</span>+</div>
          <div style="color:#cfe0dc;font-size:14px">alunos formados</div>
        </div>
        <div>
          <div style="font-size:38px;font-weight:800">4,7</div>
          <div style="color:#cfe0dc;font-size:14px">avaliação média</div>
        </div>
      </div>
    </section>

    ${courses.length
      ? html`<section class="section">
          <div class="wrap">
            <span class="eyebrow">Nossas formações</span>
            <h2 style="margin:12px 0 24px">Escolha por onde começar</h2>
            <div class="three-col">${raw(courses.slice(0, 3).map(courseCard).join(''))}</div>
            <div style="margin-top:24px">
              <a class="btn btn-outline" href="/formacoes">Ver todos os cursos</a>
            </div>
          </div>
        </section>`
      : ''}

    <section class="section" style="background:var(--surface-2)">
      <div class="wrap">
        <span class="eyebrow">Por que a ${ORG.shortName}</span>
        <h2 style="margin:12px 0 24px">Uma escolha séria para estudar psicanálise</h2>
        <div class="three-col">
          <div class="card">
            <h3 style="font-size:17px">Conteúdo estruturado</h3>
            <p style="color:var(--ink-soft);font-size:14.5px;margin-top:8px">
              Dos fundamentos de Freud às abordagens contemporâneas, em módulos progressivos.
            </p>
          </div>
          <div class="card">
            <h3 style="font-size:17px">No seu ritmo</h3>
            <p style="color:var(--ink-soft);font-size:14.5px;margin-top:8px">
              Estude quando e onde quiser, com acesso estendido e revisão do material.
            </p>
          </div>
          <div class="card">
            <h3 style="font-size:17px">Ética e transparência</h3>
            <p style="color:var(--ink-soft);font-size:14.5px;margin-top:8px">
              Responsável técnico identificado e clareza sobre os limites da formação livre.
            </p>
          </div>
        </div>
      </div>
    </section>

    ${posts.length
      ? html`<section class="section">
          <div class="wrap">
            <span class="eyebrow">Do blog</span>
            <h2 style="margin:12px 0 24px">Artigos recentes</h2>
            <div class="three-col">${raw(posts.slice(0, 3).map(postCard).join(''))}</div>
            <div style="margin-top:24px">
              <a class="btn btn-outline" href="/blog">Ver todos os artigos</a>
            </div>
          </div>
        </section>`
      : ''}

    <section class="section hero-deep" style="text-align:center">
      <div class="wrap" style="max-width:640px">
        <h2 style="color:#fff;margin-bottom:14px">Pronto para dar o primeiro passo?</h2>
        <p class="lead" style="color:#cfe0dc;margin-bottom:24px">
          Comece sua formação em psicanálise clínica hoje.
        </p>
        <a class="btn btn-primary" href="/formacoes">Ver cursos e matricular-se</a>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `${ORG.name} — Formação em Psicanálise Clínica`,
      description: `Estude psicanálise clínica com a ${ORG.shortName}: formação livre estruturada, certificado digital e ${ORG.rntp}. Desde ${ORG.founded}. Não substitui graduação em Psicologia ou Medicina.`,
      path: '/',
      activeNav: 'home',
      bodyHtml: body,
      jsonLd: [orgJsonLd(), websiteJsonLd()],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /formacoes (catálogo) ============================
publicSite.get('/formacoes', async (c) => {
  const courses = await listPublicCourses();
  const row = (co: (typeof courses)[number]): string => `
    <a class="card" href="/formacao/${co.slug}" style="display:flex;gap:18px;align-items:flex-start">
      <div aria-hidden="true" style="width:76px;height:76px;flex:0 0 auto;border-radius:12px;background:${esc(co.coverColor || 'var(--accent)')}"></div>
      <div style="flex:1">
        ${co.badge ? `<span class="tag-chip">${esc(co.badge)}</span>` : ''}
        <h3 style="font-size:19px;margin:8px 0 6px">${esc(co.title)}</h3>
        <p style="color:var(--ink-soft);font-size:14.5px">${esc((co.tagline || co.description || '').slice(0, 140))}</p>
        <div style="display:flex;gap:14px;align-items:center;margin-top:12px;flex-wrap:wrap">
          ${co.totalHours ? `<span class="tag-chip">${co.totalHours}h</span>` : ''}
          ${co.priceFormatted ? `<span style="font-weight:800">${esc(co.priceFormatted)}</span>` : ''}
          ${co.installmentFormatted ? `<span style="color:var(--ink-faint);font-size:13px">ou 12x ${esc(co.installmentFormatted)}</span>` : ''}
        </div>
      </div>
    </a>`;
  const body = html`
    <section class="section-tight hero-deep">
      <div class="wrap">
        <nav class="breadcrumb" aria-label="Trilha" style="color:#9fc0ba">
          <a href="/">Início</a><span>›</span><span>Formações</span>
        </nav>
        <span class="eyebrow">Nossas formações</span>
        <h1 style="margin:14px 0 12px">Cursos de psicanálise clínica e áreas afins</h1>
        <p class="lead" style="max-width:56ch">
          Formações livres, estruturadas e no seu ritmo, com certificado digital.
        </p>
      </div>
    </section>
    <section class="section">
      <div class="wrap">
        ${courses.length
          ? html`<div class="stack">${raw(courses.map(row).join(''))}</div>`
          : raw('<p style="color:var(--ink-soft)">Em breve novas formações.</p>')}
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `Formações — ${ORG.name}`,
      description: `Cursos e formações em psicanálise clínica da ${ORG.shortName}: estruturados, no seu ritmo, com certificado. ${ORG.rntp}.`,
      path: '/formacoes',
      activeNav: 'cursos',
      bodyHtml: body,
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Formações', path: '/formacoes' },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /formacao/:slug ============================
publicSite.get('/formacao/:slug', async (c) => {
  const co = await getPublicCourseBySlug(c.req.param('slug'));
  if (!co) {
    const nf = html`<section class="section" style="text-align:center">
      <div class="wrap">
        <h1>Formação não encontrada</h1>
        <p class="lead" style="margin:12px 0 24px">Talvez tenha mudado de endereço.</p>
        <a class="btn btn-primary" href="/formacoes">Ver todas as formações</a>
      </div>
    </section>`;
    return c.html(
      renderPage({
        title: `Formação não encontrada — ${ORG.shortName}`,
        description: 'Formação não encontrada.',
        path: `/formacao/${c.req.param('slug')}`,
        noindex: true,
        bodyHtml: nf,
      }),
      404,
      HTML_HEADERS,
    );
  }
  const chip = (t: string) => `<span class="tag-chip">${esc(t)}</span>`;
  const chips = [
    co.totalHours ? `${co.totalHours} horas` : '',
    co.level || '',
    co.language || 'pt-BR',
    co.certificateAvailable ? 'Certificado digital' : '',
  ]
    .filter(Boolean)
    .map(chip)
    .join('');
  const outcomesHtml = co.learningOutcomes.length
    ? `<h2>O que você vai aprender</h2><ul>${co.learningOutcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`
    : '';
  const forWhomHtml = co.forWhom.length
    ? `<h2>Para quem é</h2><ul>${co.forWhom.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`
    : '';
  const currHtml = co.curriculum.length
    ? `<h2>Ementa</h2><div class="stack" style="gap:10px">${co.curriculum
        .map(
          (m) =>
            `<div class="card" style="padding:16px"><div style="display:flex;gap:12px"><span style="font-weight:800;color:var(--accent)">${esc(m.n)}</span><div><div style="font-weight:700">${esc(m.title)}</div>${m.desc ? `<div style="color:var(--ink-soft);font-size:14px;margin-top:2px">${esc(m.desc)}</div>` : ''}</div></div></div>`,
        )
        .join('')}</div>`
    : '';
  const faqHtml = co.faqs.length
    ? `<h2>Perguntas frequentes</h2><div class="stack" style="gap:8px">${co.faqs
        .map(
          (f) =>
            `<div class="card" style="padding:0"><button data-accordion aria-expanded="false" style="width:100%;text-align:left;background:none;border:0;padding:16px;font-weight:700;font-size:15px;cursor:pointer;color:var(--ink);font-family:inherit">${esc(f.q)}</button><div style="max-height:0;overflow:hidden;transition:max-height .25s"><div style="padding:0 16px 16px;color:var(--ink-soft);font-size:14.5px">${esc(f.a)}</div></div></div>`,
        )
        .join('')}</div>`
    : '';
  const priceBlock = co.priceFormatted
    ? `<div style="font-size:30px;font-weight:800">${esc(co.priceFormatted)}</div>${co.installmentFormatted ? `<div style="color:var(--ink-soft);font-size:14px">ou 12x de ${esc(co.installmentFormatted)}</div>` : ''}<div style="color:var(--ink-faint);font-size:12.5px;margin-top:4px">${esc(co.priceNote || '')}</div>`
    : `<div style="font-size:20px;font-weight:800">Matrículas abertas</div><div style="color:var(--ink-soft);font-size:14px">Fale conosco para condições</div>`;
  const instructorHtml = co.instructorName
    ? `<div class="card" style="margin-top:16px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);font-weight:600">Responsável</div><div style="font-weight:700;margin-top:6px">${esc(co.instructorName)}</div>${co.instructorBio ? `<p style="color:var(--ink-soft);font-size:13.5px;margin-top:6px">${esc(co.instructorBio)}</p>` : ''}</div>`
    : '';
  const body = html`
    <section class="section-tight hero-deep">
      <div class="wrap" style="max-width:820px">
        <nav class="breadcrumb" aria-label="Trilha" style="color:#9fc0ba">
          <a href="/">Início</a><span>›</span><a href="/formacoes">Formações</a><span>›</span
          ><span>${co.shortTitle}</span>
        </nav>
        ${co.badge ? raw(`<span class="eyebrow">${esc(co.badge)}</span>`) : ''}
        <h1 style="margin:14px 0 12px">${co.title}</h1>
        ${co.tagline ? html`<p class="lead" style="color:#cfe0dc">${co.tagline}</p>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">${raw(chips)}</div>
      </div>
    </section>
    <section class="section">
      <div
        class="wrap"
        style="display:grid;grid-template-columns:1fr 340px;gap:36px;align-items:start"
      >
        <div class="prose">
          ${co.tldr
            ? raw(
                `<div class="disclaimer" style="margin-bottom:20px"><strong>Em resumo:</strong> ${esc(co.tldr)}</div>`,
              )
            : ''}
          ${co.description
            ? html`<h2>Sobre a formação</h2>
                <p>${co.description}</p>`
            : ''}
          ${raw(forWhomHtml)} ${raw(outcomesHtml)} ${raw(currHtml)} ${raw(faqHtml)}
          <div class="disclaimer" style="margin-top:24px">${YMYL_DISCLAIMER}</div>
        </div>
        <aside style="position:sticky;top:88px">
          <div class="card">
            ${raw(priceBlock)}
            <a class="btn btn-primary" href="/catalogo" style="width:100%;margin-top:16px"
              >Matricular-se</a
            >
            <a
              class="btn btn-wa"
              href="${ORG.whatsapp}"
              rel="noopener nofollow"
              style="width:100%;margin-top:10px"
              >Tirar dúvidas</a
            >
            <ul
              style="list-style:none;padding:0;margin:18px 0 0;display:grid;gap:9px;font-size:14px;color:var(--ink-soft)"
            >
              <li>✓ Acesso no seu ritmo</li>
              <li>✓ Certificado digital</li>
              <li>✓ Suporte por canais oficiais</li>
            </ul>
          </div>
          ${raw(instructorHtml)}
        </aside>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `${co.title} — ${ORG.shortName}`,
      description: (co.tldr || co.description || co.title).slice(0, 155),
      path: `/formacao/${co.slug}`,
      activeNav: 'cursos',
      bodyHtml: body,
      jsonLd: [
        courseJsonLd(co),
        faqJsonLd(co.faqs),
        breadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Formações', path: '/formacoes' },
          { name: co.title },
        ]),
      ],
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /checkout (público) ============================
publicSite.get('/checkout', async (c) => {
  const slug = c.req.query('curso') ?? '';
  const co = slug ? await getPublicCourseBySlug(slug) : null;
  if (!co) return c.redirect('/formacoes', 302);
  const forSale = co.priceCents != null;
  const summary = `
    <div class="card">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);font-weight:600">Sua matrícula</div>
      <h3 style="font-size:18px;margin:8px 0 10px">${esc(co.title)}</h3>
      ${
        forSale
          ? `<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line-soft);padding-top:12px;margin-top:12px">
               <span style="color:var(--ink-soft)">Total</span>
               <span style="font-size:24px;font-weight:800">${esc(co.priceFormatted || '')}</span>
             </div>
             ${co.installmentFormatted ? `<div style="text-align:right;color:var(--ink-soft);font-size:13px">ou 12x de ${esc(co.installmentFormatted)}</div>` : ''}`
          : '<p style="color:var(--ink-soft);font-size:14px;margin-top:8px">Este curso ainda não está com matrícula online. Fale com a gente pelo WhatsApp.</p>'
      }
    </div>`;
  const form = forSale
    ? `
    <form data-checkout data-slug="${esc(co.slug)}" class="card" style="display:grid;gap:14px">
      <div>
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Nome completo</label>
        <input name="name" required minlength="2" autocomplete="name" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit">
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">E-mail</label>
        <input name="email" type="email" required autocomplete="email" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">WhatsApp</label>
          <input name="whatsapp" autocomplete="tel" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">CPF</label>
          <input name="document" inputmode="numeric" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit">
        </div>
      </div>
      <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--ink-soft);cursor:pointer">
        <input type="checkbox" name="consent" required style="margin-top:3px">
        <span>Concordo com os <a href="/termos" style="color:var(--accent)">Termos</a> e a <a href="/privacidade" style="color:var(--accent)">Política de Privacidade</a> (LGPD).</span>
      </label>
      <button type="submit" data-checkout-submit class="btn btn-primary" style="width:100%">Ir para o pagamento</button>
      <p data-checkout-error role="alert" style="display:none;color:var(--crit);font-size:13.5px;margin:0"></p>
      <p style="color:var(--ink-faint);font-size:12px;margin:0;text-align:center">Pagamento processado com segurança pelo gateway. Você recebe um e-mail para definir sua senha de acesso.</p>
    </form>`
    : `<a class="btn btn-wa" href="${ORG.whatsapp}" rel="noopener nofollow" style="width:100%">Falar no WhatsApp</a>`;
  const body = html`
    <section class="section">
      <div class="wrap" style="max-width:920px">
        <nav class="breadcrumb" aria-label="Trilha">
          <a href="/">Início</a><span>›</span><a href="/formacoes">Formações</a><span>›</span
          ><a href="/formacao/${co.slug}">${co.shortTitle}</a><span>›</span><span>Checkout</span>
        </nav>
        <h1 style="margin:8px 0 24px">Finalizar matrícula</h1>
        <div style="display:grid;grid-template-columns:1fr 340px;gap:28px;align-items:start">
          <div>${raw(form)}</div>
          <aside style="position:sticky;top:88px">${raw(summary)}</aside>
        </div>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `Checkout — ${co.title} | ${ORG.shortName}`,
      description: `Finalize sua matrícula em ${co.title}.`,
      path: `/checkout?curso=${co.slug}`,
      noindex: true,
      activeNav: 'cursos',
      bodyHtml: body,
    }),
    200,
    HTML_HEADERS,
  );
});
