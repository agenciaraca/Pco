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
import { ORG, AUTHOR, YMYL_DISCLAIMER } from './config';
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
} from './jsonld';
import { listPublicPosts, getPublicPostBySlug, listPublicCourses } from './projections';
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
          <a class="btn btn-primary" href="/autor" style="width:100%"
            >Conheça o responsável técnico</a
          >
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
            `<a class="btn btn-outline" href="/curso/${s}" style="margin:0 8px 8px 0">Ver curso</a>`,
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
            Por <a href="/autor" style="color:var(--accent)">${post.authorName}</a> ·
            ${raw(fmtDate(post.publishedAt))} · ${post.readingMinutes} min de leitura
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
              <a href="/autor" style="color:var(--accent);font-size:14px"
                >Conheça o responsável técnico →</a
              >
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
    <a class="card" href="/catalogo" style="display:block">
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
          <a class="btn btn-primary" href="/catalogo">Ver cursos</a>
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
              <a class="btn btn-outline" href="/catalogo">Ver todos os cursos</a>
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
        <a class="btn btn-primary" href="/catalogo">Ver cursos e matricular-se</a>
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
