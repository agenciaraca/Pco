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
import { renderPage, pincel, ICONE_WHATSAPP } from './layout';
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
  numerosDoSite,
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
  /**
   * "Em números" — medido, como na home.
   *
   * Este quadro afirmava "1000+ alunos formados", "4,7 avaliação média" e
   * "3 formações". Os dois primeiros nunca foram medidos; o terceiro estava
   * simplesmente errado — o catálogo público tem bem mais que três. Número de
   * catálogo se conta.
   */
  const numerosSobre = await numerosDoSite(ORG.founded);
  const cursosPublicos = await listPublicCourses();
  const celulasSobre = [
    numerosSobre.anos ? { valor: String(ORG.founded ?? ''), rotulo: 'no ar desde' } : null,
    cursosPublicos.length
      ? {
          valor: String(cursosPublicos.length),
          rotulo: `formaç${cursosPublicos.length === 1 ? 'ão' : 'ões'} no catálogo`,
        }
      : null,
    numerosSobre.formados
      ? { valor: String(numerosSobre.formados), rotulo: 'certificados emitidos' }
      : null,
    numerosSobre.avaliacao
      ? {
          valor: numerosSobre.avaliacao.media.toLocaleString('pt-BR', {
            minimumFractionDigits: 1,
          }),
          rotulo: `avaliação média · ${numerosSobre.avaliacao.total} avaliaç${numerosSobre.avaliacao.total === 1 ? 'ão' : 'ões'}`,
        }
      : null,
  ].filter(Boolean) as { valor: string; rotulo: string }[];

  const emNumerosHtml = celulasSobre.length
    ? `<div class="card">
         <h3 style="margin-bottom:6px">Em números</h3>
         <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:12px">
           ${celulasSobre
             .map(
               (n) =>
                 `<div><div style="font-size:30px;font-weight:800;color:var(--accent)">${esc(n.valor)}</div><div style="font-size:13px;color:var(--ink-soft)">${esc(n.rotulo)}</div></div>`,
             )
             .join('')}
         </div>
       </div>`
    : '';
  const body = html`
    <section class="section-tight hero-deep tem-pincel">
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
      ${pincel('var(--paper)')}
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
          ${raw(emNumerosHtml)}
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
  // Sem pessoa nomeada assinando o conteúdo, a página não existe: a autoria da
  // PCO é institucional, e publicar um responsável técnico anônimo com
  // credenciais anexadas atribuiria formação em saúde mental a ninguém. O
  // `AUTHOR === null` é o que garante isso ao compilador, não só a nós.
  const autor = AUTHOR;
  if (AUTHOR_IS_PLACEHOLDER || autor === null) return c.notFound();
  const initials =
    autor.name
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
            ${autor.photo
              ? raw(
                  `<img src="${autor.photo}" alt="${autor.name}" width="140" height="140" style="width:140px;height:140px;border-radius:50%;object-fit:cover;margin:0 auto 14px">`,
                )
              : raw(
                  `<div aria-hidden="true" style="width:140px;height:140px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;font-size:52px;font-weight:800;color:#fff;background:linear-gradient(135deg,#0a3f3a,#1f9e93)">${initials}</div>`,
                )}
            <h1 style="font-size:24px">${autor.name}</h1>
            <p style="color:var(--ink-soft);font-size:14.5px;margin-top:4px">${autor.honorific}</p>
            <div
              style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap"
            >
              ${raw(
                autor.sameAs
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
                autor.credentials
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
          <p>${autor.bio}</p>
          <p>${autor.experience}</p>
          <div class="disclaimer" style="margin-top:20px">${YMYL_DISCLAIMER}</div>
        </div>
      </div>
    </section>
  `;
  return c.html(
    renderPage({
      title: `${autor.name} — Responsável técnico | ${ORG.shortName}`,
      description: `${autor.name}, ${autor.jobTitle} da ${ORG.shortName}. ${autor.bio.slice(0, 120)}`,
      path: '/autor',
      ogType: 'profile',
      bodyHtml: body,
      jsonLd: [
        personJsonLd(autor),
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
      ${p.category ? `<span class="tag-chip tag-categoria">${esc(p.category)}</span>` : ''}
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
  const [courses, posts, numeros] = await Promise.all([
    listPublicCourses(),
    listPublicPosts(),
    numerosDoSite(ORG.founded),
  ]);

  /**
   * A faixa de confiança do hero e a barra de números — do protótipo aprovado,
   * mas com o que dá para medir.
   *
   * O desenho pede "4,7/5 · avaliação dos alunos", "+1000 alunos formados" e
   * "96% de satisfação". Nenhum dos três tinha medição atrás, e a home já
   * publicava dois deles. A regra do projeto é a mesma desde o `/ava-pco`:
   * número em página de venda é afirmação de resultado, e afirmação de
   * resultado tem dono (CDC, art. 37). Aqui a avaliação sai das avaliações
   * reais e **anda com a base**; "formados" é contagem de certificado emitido;
   * satisfação não entra porque não existe pesquisa de satisfação no sistema.
   *
   * Cada item some sozinho quando não há o que medir — a faixa nunca mostra
   * zero, porque numa página de venda zero é pior do que ausência.
   */
  const itensConfianca = [
    numeros.avaliacao
      ? `<span class="item"><span class="estrelas" aria-hidden="true">★★★★★</span><span><strong>${numeros.avaliacao.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}/5</strong> · ${numeros.avaliacao.total} avaliaç${numeros.avaliacao.total === 1 ? 'ão' : 'ões'} de alunos</span></span>`
      : '',
    `<span class="item"><span class="selo">RNTP</span><span>Escola reconhecida</span></span>`,
  ]
    .filter(Boolean)
    .join('');

  const celulas = [
    numeros.anos
      ? {
          valor: `${numeros.anos}`,
          rotulo: 'anos de escola',
          base: `desde ${esc(ORG.founded ?? '')}`,
        }
      : null,
    numeros.formados
      ? {
          valor: `${numeros.formados}`,
          rotulo: 'certificados emitidos',
          base: 'contagem no sistema',
        }
      : null,
    numeros.avaliacao
      ? {
          valor: numeros.avaliacao.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 }),
          rotulo: 'avaliação média',
          base: `${numeros.avaliacao.total} avaliaç${numeros.avaliacao.total === 1 ? 'ão' : 'ões'}`,
        }
      : null,
    { valor: 'RNTP', rotulo: 'escola reconhecida', base: esc(ORG.rntp ?? '') },
  ].filter(Boolean) as { valor: string; rotulo: string; base: string }[];

  const barraNumeros = celulas
    .map(
      (n) =>
        `<div><div class="valor">${esc(n.valor)}</div><div class="rotulo">${esc(n.rotulo)}</div><div class="base">${n.base}</div></div>`,
    )
    .join('');

  const ladrilhos = [
    'Compreenda a mente humana com profundidade',
    'Atue com técnica e postura ética',
    'Estude no seu próprio ritmo',
    'Construa uma nova trajetória',
  ]
    .map((t) => `<div class="ladrilho"><span>${esc(t)}</span></div>`)
    .join('');

  const porque = [
    ['Aulas em vídeo', 'Conteúdo em vídeo com aulas exclusivas e indicações complementares.'],
    ['Material 24h', 'Todo o material na plataforma para revisar quantas vezes precisar.'],
    ['Início imediato', 'Acesso liberado após a confirmação do pagamento.'],
    ['Pagamento facilitado', 'Parcele no boleto ou no cartão, conforme as condições vigentes.'],
    ['Certificado digital', 'Certificado sem custo adicional ao concluir e quitar o curso.'],
    ['Reconhecimento RNTP', 'Cursos avaliados e reconhecidos pela RNTP.'],
  ]
    .map(
      ([t, d], i) =>
        `<div class="porque-item"><div class="n">${i + 1}</div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`,
    )
    .join('');
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
    <section class="hero-deep" style="padding:clamp(56px,9vw,110px) 0 150px;overflow:hidden">
      <div
        class="hero-foto"
        style="background-image:url('/img/hero-consultorio.webp')"
        aria-hidden="true"
      ></div>
      <div class="hero-veu" aria-hidden="true"></div>
      <div class="wrap" style="max-width:820px">
        <span class="eyebrow">Formação livre em psicanálise clínica · desde ${ORG.founded}</span>
        <h1 style="margin:18px 0 18px">Estude psicanálise clínica com seriedade, no seu ritmo</h1>
        <p class="lead" style="max-width:60ch">
          Percursos estruturados dos fundamentos freudianos às abordagens contemporâneas — com
          certificado digital, ética e o reconhecimento da ${ORG.rntp}.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px">
          <a class="btn btn-cta btn-lg" href="/formacoes">Ver os cursos</a>
          <a class="btn btn-wa" href="${ORG.whatsapp}" rel="noopener nofollow"
            >${ICONE_WHATSAPP} Falar no WhatsApp</a
          >
        </div>
        <div class="hero-confianca">${raw(itensConfianca)}</div>
      </div>
      ${pincel('var(--paper)')}
    </section>

    <section class="section">
      <div class="wrap afirmacao">
        <div>
          <h2>
            Com conteúdo estruturado e estudo no seu tempo, você desenvolve a base necessária para
            atuar com técnica e ética na psicanálise clínica.
          </h2>
          <a class="maisinfo" href="/formacoes"
            >Conheça os cursos <span aria-hidden="true">→</span></a
          >
        </div>
        <div class="ladrilhos">${raw(ladrilhos)}</div>
      </div>
    </section>

    <section class="section-tight" style="background:var(--brand-gradient)">
      <div class="wrap barra-numeros">${raw(barraNumeros)}</div>
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
        <span class="eyebrow">Por que escolher a ${ORG.shortName}</span>
        <h2 style="margin:12px 0 24px">A escolha inteligente para estudar psicanálise</h2>
        <div class="porque">${raw(porque)}</div>
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
        <a class="btn btn-cta btn-lg" href="/formacoes">Ver os cursos</a>
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

  /**
   * Linha de curso — transposição de `docs/design/pages/Cursos.dc.html`.
   *
   * A lista era uma grade de cartões (desenho herdado do `/catalogo`). O
   * protótipo aprovado troca por linhas largas: capa à esquerda; à direita
   * título, resumo, pastilhas, preço e as duas ações. É aqui que a pessoa
   * escolhe entre as formações, e cartão pequeno não dá espaço para comparar.
   *
   * O protótipo põe "Adicionar ao carrinho" como ação laranja. **Não existe
   * página de carrinho neste site** — só o contador no topo. Botão que não
   * leva a lugar nenhum foi exatamente o defeito consertado no
   * "Matricular-se" da página do curso, então aqui a ação laranja vai direto
   * ao checkout, e some quando o curso não tem preço.
   */
  const linha = (co: (typeof courses)[number]): string => {
    const capa = co.coverImageUrl
      ? `<img src="${esc(co.coverImageUrl)}" alt="" loading="lazy" decoding="async" />`
      : '';

    const chips = [
      co.modules ? `${co.modules} módulo${co.modules === 1 ? '' : 's'}` : '',
      co.lessons ? `${co.lessons} aula${co.lessons === 1 ? '' : 's'}` : '',
      co.totalHours ? `${co.totalHours} horas/aula` : '',
      'Certificado digital',
    ]
      .filter(Boolean)
      .map((t) => `<span>${esc(t)}</span>`)
      .join('');

    // Sem preço não se inventa número: fica o rótulo honesto, e a ação laranja
    // sai de cena — quem decide sem preço fala com gente, na página do curso.
    const preco = co.priceFormatted
      ? `<div>
           <div class="curso-linha-preco">${esc(co.priceFormatted)}</div>
           ${
             co.installmentFormatted
               ? `<div class="curso-linha-parcela">ou ${co.installments}x de ${esc(co.installmentFormatted)}</div>`
               : ''
           }
         </div>`
      : `<div>
           <div class="curso-linha-preco">Matrículas abertas</div>
           <div class="curso-linha-parcela">condições pelos canais oficiais</div>
         </div>`;

    const href = `/formacao/${esc(co.slug)}`;
    /**
     * Duas ações quando há preço, como no protótipo: juntar ao carrinho ou ir
     * direto. Sem preço, nenhuma das duas aparece — não há o que somar nem o
     * que cobrar, e a página do curso oferece o caminho por WhatsApp.
     */
    const matricular =
      co.priceCents != null
        ? `<button type="button" class="btn btn-outline" data-add-cart
             data-slug="${esc(co.slug)}" data-title="${esc(co.shortTitle || co.title)}"
             data-price="${(co.priceCents / 100).toFixed(2)}">Adicionar ao carrinho</button>
           <a class="btn btn-cta" href="/checkout?curso=${esc(co.slug)}">Matricular-se</a>`
        : '';

    return `
    <article class="curso-linha">
      <a class="curso-linha-capa" href="${href}" aria-label="${esc(co.title)}">
        ${capa}
        ${co.badge ? `<span class="curso-linha-selo">${esc(co.badge)}</span>` : ''}
      </a>
      <div class="curso-linha-corpo">
        <a class="curso-linha-titulo" href="${href}">${esc(co.title)}</a>
        <p class="curso-linha-resumo">${esc(co.tagline || co.description || '')}</p>
        <div class="curso-linha-chips">${chips}</div>
        <div class="curso-linha-rodape">
          ${preco}
          <div class="curso-linha-acoes">
            <a class="btn btn-outline" href="${href}">Ver curso</a>
            ${matricular}
          </div>
        </div>
      </div>
    </article>`;
  };

  const body = html`
    <section class="lista-topo">
      <nav class="lista-trilha" aria-label="Trilha">
        <a href="/">Início</a> / <span class="atual">Cursos</span>
      </nav>
      <span class="eyebrow">Formações online</span>
      <h1>Escolha a formação certa para o seu momento</h1>
      <p class="lead">
        Todas as formações são 100% online, com estudo no seu ritmo, certificado digital e suporte
        pelos canais oficiais. Cada curso tem uma página com ementa completa e valores.
      </p>
    </section>

    <section class="lista-cursos">
      ${courses.length
        ? raw(courses.map(linha).join(''))
        : raw('<p style="color:var(--ink-soft)">Em breve novos cursos.</p>')}
    </section>

    <section class="lista-ajuda">
      <div class="dentro">
        <h2>Não sabe por onde começar?</h2>
        <p>
          Fale com a nossa equipe pelo WhatsApp. Ajudamos você a escolher a formação mais adequada
          ao seu objetivo — sem compromisso.
        </p>
        ${raw(
          `<a class="btn btn-wa" href="${ORG.whatsapp}" rel="noopener nofollow">${ICONE_WHATSAPP} Falar no WhatsApp</a>`,
        )}
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
  /**
   * A página do curso — transposição do protótipo aprovado pelo dono
   * (`docs/design/pages/Curso.dc.html`, projeto "Inspiração Loyalist College").
   *
   * O que existia aqui era ementa + preço. O desenho escolhido transforma a
   * página em argumento de venda: resumo rápido, "para quem é" ao lado de "o
   * que você desenvolve", ementa numerada, destaques, seções longas com par de
   * CTAs, jornada, FAQ e a letra miúda. O estilo saiu do style inline do
   * protótipo e virou classe em `styles.ts` — era o que a etapa 4 pedia.
   *
   * Cada bloco só aparece se tiver conteúdo: curso sem `sections` mantém a
   * página curta, sem buraco na tela.
   *
   * **O preço nunca é inventado.** O protótipo traz R$ 1.497 como dado de
   * exemplo; aqui o valor vem sempre do produto ativo. Sem produto, a caixa
   * mantém o formato e diz a verdade, em vez de exibir um número de maquete.
   */
  const wa = ORG.whatsapp;
  const temPreco = co.priceCents != null;
  /** Para onde vai quem decidiu comprar. Sem preço, o único caminho real é gente. */
  const destinoCompra = temPreco ? `/checkout?curso=${esc(co.slug)}` : wa;

  /**
   * "Acesso 4–16 meses" no desenho. Vem de `monthsMin`/`monthsMax`, que são
   * RITMO DE ESTUDO declarado — não confundir com `accessMonths`, que expira a
   * matrícula. Curso que não declarou nada não ganha a pastilha: prazo é
   * promessa, e promessa sem dado atrás vira propaganda enganosa.
   */
  const prazoTexto =
    co.monthsMin && co.monthsMax
      ? `Acesso ${co.monthsMin}–${co.monthsMax} meses`
      : co.monthsMax
        ? `Acesso até ${co.monthsMax} meses`
        : '';

  const chips = [
    co.modules ? `${co.modules} módulos` : '',
    co.lessons ? `${co.lessons} aulas` : '',
    co.totalHours ? `${co.totalHours} horas/aula` : '',
    prazoTexto,
    co.certificateAvailable ? 'Certificado digital' : '',
  ]
    .filter(Boolean)
    .map((t) => `<span>${esc(t)}</span>`)
    .join('');

  /**
   * O par de CTAs que fecha cada seção longa, como no protótipo: laranja para
   * comprar, verde para falar com gente.
   *
   * Sem preço, o laranja sairia apontando para o mesmo WhatsApp do botão ao
   * lado — dois botões para o mesmo lugar, um deles prometendo matrícula que
   * ainda não existe. Nesse caso fica só o verde.
   */
  const parCtaHtml = `<div class="curso-cta-par">
      ${temPreco ? `<a class="btn btn-cta" href="${destinoCompra}">QUERO ME MATRICULAR</a>` : ''}
      <a class="btn btn-wa" href="${wa}" rel="noopener nofollow">${ICONE_WHATSAPP} Quero Falar No Whatsapp</a>
    </div>`;

  const tldrHtml = co.tldr
    ? `<div class="curso-tldr"><div class="rotulo">Resumo rápido</div><p>${esc(co.tldr)}</p></div>`
    : '';

  const sobreHtml = co.description
    ? `<h2>Sobre a formação</h2><p class="curso-texto">${esc(co.description)}</p>`
    : '';

  const CHECK_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent)" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  const colunaForWhom = co.forWhom.length
    ? `<div><h3>Para quem é</h3><ul class="curso-lista">${co.forWhom
        .map((f) => `<li><span class="seta" aria-hidden="true">›</span><span>${esc(f)}</span></li>`)
        .join('')}</ul></div>`
    : '';
  const colunaOutcomes = co.learningOutcomes.length
    ? `<div><h3>O que você desenvolve</h3><ul class="curso-lista">${co.learningOutcomes
        .map((o) => `<li>${CHECK_SVG}<span>${esc(o)}</span></li>`)
        .join('')}</ul></div>`
    : '';
  const duasColunasHtml =
    colunaForWhom || colunaOutcomes
      ? `<div class="curso-duas">${colunaForWhom}${colunaOutcomes}</div>`
      : '';

  const ementaHtml = co.curriculum.length
    ? `<h2>Conteúdo do curso</h2><div class="curso-ementa">${co.curriculum
        .map(
          (m) =>
            `<div class="curso-ementa-item"><div class="curso-ementa-n">${esc(m.n)}</div><div><div class="t">${esc(m.title)}</div>${m.desc ? `<div class="d">${esc(m.desc)}</div>` : ''}</div></div>`,
        )
        .join('')}</div>`
    : '';

  const destaquesHtml = co.highlights.length
    ? `<div class="curso-destaques">${co.highlights
        .map(
          (h) =>
            `<div class="curso-destaque"><div class="t">${esc(h.title)}</div>${h.note ? `<div class="n">${esc(h.note)}</div>` : ''}</div>`,
        )
        .join('')}</div>`
    : '';

  const secoesHtml = co.sections
    .map(
      (sec) =>
        `<div class="curso-secao"><h2>${esc(sec.title)}</h2>${sec.subtitle ? `<div class="sub">${esc(sec.subtitle)}</div>` : ''}${sec.paras
          .map((par) => `<p>${esc(par)}</p>`)
          .join('')}${sec.cta ? parCtaHtml : ''}</div>`,
    )
    .join('');

  const jornadaHtml = co.jornada.length
    ? `<div class="curso-jornada">${co.jornada
        .map(
          (j) =>
            `<div class="curso-jornada-item"><h3>${esc(j.title)}</h3>${j.subtitle ? `<div class="sub">${esc(j.subtitle)}</div>` : ''}<p>${esc(j.text)}</p></div>`,
        )
        .join('')}</div>`
    : '';

  const faqHtml = co.faqs.length
    ? `<h2>Perguntas frequentes</h2><div class="curso-faqs">${co.faqs
        .map(
          (f) =>
            `<div class="curso-faq"><button data-accordion aria-expanded="false"><span>${esc(f.q)}</span><span class="mais" aria-hidden="true">+</span></button><div class="curso-faq-corpo"><div>${esc(f.a)}</div></div></div>`,
        )
        .join('')}</div>`
    : '';

  /**
   * Regulamento da promoção (quando houver) e o aviso de formação livre, que é
   * obrigatório em toda página de curso — ver a seção 7 do inventário de design.
   */
  const miudoHtml = `<div class="curso-miudo">${
    co.promoNote ? `<span class="promo">${esc(co.promoNote)}</span>` : ''
  }<strong>Aviso importante:</strong> ${YMYL_DISCLAIMER}</div>`;

  const perks = [
    prazoTexto,
    co.certificateAvailable ? 'Certificado digital incluso' : '',
    'Material disponível 24h',
    'Suporte pelos canais oficiais',
  ]
    .filter(Boolean)
    .map((t) => `<div><span class="ok" aria-hidden="true">✓</span><span>${esc(t)}</span></div>`)
    .join('');

  const caixaPrecoHtml = temPreco
    ? `<div class="curso-invest">Investimento · à vista</div>
       <div class="curso-preco">${esc(co.priceFormatted || '')}</div>
       ${co.installmentFormatted ? `<div class="curso-parcela">ou ${co.installments}x de ${esc(co.installmentFormatted)}</div>` : ''}
       ${co.priceNote ? `<div class="curso-preco-nota">${esc(co.priceNote)}</div>` : ''}
       <a class="btn btn-cta" href="${destinoCompra}">Matricular-se agora</a>
       <button type="button" class="btn btn-outline" data-add-cart
         data-slug="${esc(co.slug)}" data-title="${esc(co.shortTitle || co.title)}"
         data-price="${((co.priceCents ?? 0) / 100).toFixed(2)}">Adicionar ao carrinho</button>
       <a class="curso-duvida" href="${wa}" rel="noopener nofollow">Tirar dúvidas no WhatsApp</a>`
    : `<div class="curso-invest">Matrículas abertas</div>
       <div class="curso-preco-nota" style="margin-top:8px">Este curso ainda não tem matrícula online. Fale com a gente para saber as condições.</div>
       <a class="btn btn-wa" href="${wa}" rel="noopener nofollow">${ICONE_WHATSAPP} Falar sobre a matrícula</a>`;

  const instructorHtml = co.instructorName
    ? `<div class="card" style="margin-top:16px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);font-weight:600">Responsável</div><div style="font-weight:700;margin-top:6px">${esc(co.instructorName)}</div>${co.instructorBio ? `<p style="color:var(--ink-soft);font-size:13.5px;margin-top:6px">${esc(co.instructorBio)}</p>` : ''}</div>`
    : '';

  const body = html`
    <section class="curso-hero">
      <div class="curso-hero-veu"></div>
      <div class="curso-wrap">
        <nav class="curso-trilha" aria-label="Trilha">
          <a href="/">Início</a> / <a href="/formacoes">Cursos</a> /
          <span class="atual">${co.shortTitle}</span>
        </nav>
        ${raw(
          `<span class="curso-pilula">${esc([co.badge, co.level].filter(Boolean).join(' · '))}</span>`,
        )}
        <h1>${co.title}</h1>
        ${co.tagline ? html`<p class="curso-lema">${co.tagline}</p>` : ''}
        <div class="curso-chips">${raw(chips)}</div>
      </div>
      ${pincel('var(--paper)')}
    </section>

    <section class="curso-layout">
      <div class="curso-corpo">
        ${raw(tldrHtml)} ${raw(sobreHtml)} ${raw(duasColunasHtml)} ${raw(ementaHtml)}
        ${raw(destaquesHtml)} ${raw(secoesHtml)} ${raw(jornadaHtml)} ${raw(faqHtml)}
        ${raw(miudoHtml)}
      </div>

      <aside class="curso-matricula">
        <div class="caixa">
          ${raw(caixaPrecoHtml)}
          <div class="curso-perks">${raw(perks)}</div>
        </div>
        <div class="curso-arrependimento">Direito de arrependimento em até 7 dias corridos.</div>
        ${raw(instructorHtml)}
      </aside>
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

/**
 * O formulário do checkout, um só para os dois modos.
 *
 * `curso` manda um slug; `carrinho` manda a lista que está no localStorage —
 * quem monta o payload é o `/_pub/site.js`, e em nenhum dos dois casos o preço
 * sai do navegador: quem soma é o servidor.
 *
 * Os campos de cartão do protótipo não vêm: o pagamento acontece na página do
 * provedor. Ver o comentário da rota /checkout.
 */
const CADEADO_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function formularioCheckout(modo: { tipo: 'curso'; slug: string } | { tipo: 'carrinho' }): string {
  const atrs =
    modo.tipo === 'curso'
      ? `data-checkout data-slug="${esc(modo.slug)}"`
      : 'data-checkout data-checkout-carrinho';
  return `
    <form ${atrs} class="ck-coluna">
      <div class="ck-bloco">
        <h2>1. Seus dados</h2>
        <div class="ck-campos">
          <div>
            <label class="lbl" for="ck-nome">Nome completo</label>
            <input class="fi" id="ck-nome" name="name" required minlength="2" autocomplete="name" placeholder="Seu nome">
          </div>
          <div class="ck-dupla">
            <div>
              <label class="lbl" for="ck-email">E-mail</label>
              <input class="fi" id="ck-email" name="email" type="email" required autocomplete="email" placeholder="voce@email.com">
            </div>
            <div>
              <label class="lbl" for="ck-zap">WhatsApp</label>
              <input class="fi" id="ck-zap" name="whatsapp" autocomplete="tel" placeholder="(00) 00000-0000">
            </div>
          </div>
          <div>
            <label class="lbl" for="ck-cpf">CPF</label>
            <input class="fi" id="ck-cpf" name="document" inputmode="numeric" placeholder="000.000.000-00">
          </div>
        </div>
      </div>

      <div class="ck-bloco">
        <h2>2. Pagamento</h2>
        <div class="ck-provedor">
          <span class="selo">${CADEADO_SVG}</span>
          <span>
            O pagamento é feito na página segura do provedor. Ao continuar, você escolhe
            lá a forma de pagamento disponível — cartão, Pix ou boleto, conforme o provedor.
            <strong>Nenhum dado de cartão é digitado ou guardado neste site.</strong>
          </span>
        </div>
      </div>

      <label class="ck-lgpd">
        <input type="checkbox" name="consent" required>
        <span>Li e concordo com os <a href="/termos">Termos de Uso</a> e a
          <a href="/privacidade">Política de Privacidade</a>. Autorizo o tratamento dos meus
          dados conforme a LGPD para fins de matrícula e comunicação.</span>
      </label>

      <p data-checkout-error role="alert" class="ck-erro" style="display:none"></p>

      <button type="submit" data-checkout-submit class="btn btn-cta ck-pagar">Ir para o pagamento</button>

      <p class="ck-nota">
        Você recebe um e-mail para definir sua senha de acesso. O acesso é liberado após a
        confirmação do pagamento.
      </p>
    </form>`;
}

// ============================ /carrinho ============================
/**
 * O carrinho vive no `localStorage` deste navegador — o servidor não sabe o que
 * tem nele, e é assim de propósito: guardar carrinho no servidor exigiria
 * identificar quem está navegando antes de a pessoa decidir comprar.
 *
 * A página, então, chega vazia e é preenchida por `/_pub/site.js`. Sem JS fica
 * o aviso — nunca uma lista vazia se passando por "seu carrinho está vazio",
 * que são coisas diferentes.
 */
publicSite.get('/carrinho', async (c) => {
  /**
   * Transposição de `docs/design/pages/Carrinho.dc.html`.
   *
   * O carrinho vive no `localStorage` deste navegador — o servidor não sabe o
   * que tem nele, e é assim de propósito: guardar carrinho no servidor exigiria
   * identificar quem está navegando antes de a pessoa decidir comprar. A página
   * chega com os dois estados prontos e escondidos, e o `/_pub/site.js` mostra o
   * que couber. Sem JS fica o aviso — nunca uma lista vazia se passando por
   * "carrinho vazio", que são coisas diferentes.
   *
   * **O seletor de quantidade do protótipo não veio.** Ele desenha "− 1 +" em
   * cada item, como qualquer loja. Só que curso não se compra em dobro: comprar
   * duas vezes não dá dois acessos, e o servidor colapsa duplicata ao montar o
   * pedido (`test/checkout-carrinho.test.ts`). Um botão que deixasse marcar 3 e
   * cobrasse 1 seria exatamente a tela que mente que este projeto persegue.
   *
   * "Descontos —" fica como travessão: existe cupom no sistema, mas o checkout
   * público não aplica nenhum. Travessão diz "não há"; "R$ 0,00" diria que
   * alguém calculou.
   */
  const body = html`
    <section class="carrinho-topo">
      <nav class="carrinho-trilha" aria-label="Trilha">
        <a href="/">Início</a> / <span class="atual">Carrinho</span>
      </nav>
      <h1>Seu carrinho</h1>
    </section>

    <noscript>
      <div class="wrap" style="max-width:1100px">
        <div class="disclaimer">
          O carrinho depende de JavaScript, porque ele fica guardado neste navegador. Você pode se
          matricular direto pela página de cada formação.
        </div>
      </div>
    </noscript>

    <section class="carrinho-vazio" data-carrinho-vazio style="display:none">
      ${raw(
        `<div class="icone"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>`,
      )}
      <h2>Seu carrinho está vazio</h2>
      <p>Explore as formações da PCO e comece sua jornada na psicanálise clínica.</p>
      <a class="btn btn-primary" href="/formacoes">Ver os cursos</a>
    </section>

    <section class="carrinho-layout" data-carrinho-corpo style="display:none">
      <div>
        <div class="carrinho-itens" data-carrinho-lista></div>
        <a class="carrinho-continuar" href="/formacoes">← Continuar escolhendo cursos</a>
      </div>

      <aside class="carrinho-resumo">
        <h2>Resumo</h2>
        <div class="carrinho-linha"><span>Subtotal</span><span data-carrinho-subtotal>—</span></div>
        <div class="carrinho-linha"><span>Descontos</span><span>—</span></div>
        <div class="carrinho-total">
          <span class="rotulo">Total</span>
          <span class="valor" data-carrinho-total>—</span>
        </div>
        <div class="carrinho-nota">ou parcelado no cartão · condições no checkout</div>
        <a class="btn btn-cta" href="/checkout?carrinho=1">Ir para o checkout</a>
        ${raw(
          `<a class="carrinho-zap" href="${ORG.whatsapp}" rel="noopener nofollow">Dúvidas? Fale no WhatsApp</a>`,
        )}
      </aside>
    </section>
  `;
  return c.html(
    renderPage({
      title: `Carrinho — ${ORG.shortName}`,
      description: 'Formações escolhidas.',
      path: '/carrinho',
      noindex: true,
      activeNav: 'cursos',
      bodyHtml: body,
    }),
    200,
    HTML_HEADERS,
  );
});

// ============================ /checkout (público) ============================
publicSite.get('/checkout', async (c) => {
  /**
   * Dois modos: um curso (`?curso=slug`) ou o carrinho (`?carrinho=1`).
   *
   * No modo carrinho o servidor NÃO sabe o que a pessoa escolheu — o carrinho
   * mora no localStorage. Então o resumo chega vazio e é preenchido pelo
   * `/_pub/site.js`, e o valor real é o que o servidor soma na hora de criar o
   * pedido. O número na tela é conferência; o que cobra é o backend.
   */
  if (c.req.query('carrinho') === '1') {
    const corpoCarrinho = html`
      <section class="ck-wrap">
        <nav class="ck-trilha" aria-label="Trilha">
          <a href="/">Início</a> / <a href="/formacoes">Cursos</a> /
          <a href="/carrinho">Carrinho</a> / <span class="atual">Checkout</span>
        </nav>
        <h1>Finalizar matrícula</h1>
        <p class="ck-sub">Formações escolhidas no seu carrinho.</p>
        <div class="ck-layout">
          ${raw(formularioCheckout({ tipo: 'carrinho' }))}
          <aside class="ck-resumo">
            <h2>Sua matrícula</h2>
            <div data-carrinho-vazio style="display:none">
              <p style="color:var(--ink-soft);font-size:14px">
                Seu carrinho está vazio.
                <a href="/formacoes" style="color:var(--accent)">Ver formações</a>.
              </p>
            </div>
            <div data-carrinho-corpo style="display:none">
              <div class="ck-itens" data-carrinho-lista></div>
              <div class="ck-total">
                <span class="rotulo">Total</span>
                <span class="valor" data-carrinho-total>—</span>
              </div>
              <div class="ck-garantias">
                <div>
                  <span class="ok" aria-hidden="true">✓</span
                  ><span>Acesso imediato após a confirmação</span>
                </div>
                <div>
                  <span class="ok" aria-hidden="true">✓</span
                  ><span>Direito de arrependimento em 7 dias</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    `;
    return c.html(
      renderPage({
        title: `Checkout — ${ORG.shortName}`,
        description: 'Finalize sua matrícula.',
        path: '/checkout?carrinho=1',
        noindex: true,
        activeNav: 'cursos',
        bodyHtml: corpoCarrinho,
      }),
      200,
      HTML_HEADERS,
    );
  }

  const slug = c.req.query('curso') ?? '';
  const co = slug ? await getPublicCourseBySlug(slug) : null;
  if (!co) return c.redirect('/formacoes', 302);
  const forSale = co.priceCents != null;

  /**
   * Checkout — transposição de `docs/design/pages/Checkout.dc.html`.
   *
   * Duas coisas do protótipo NÃO vieram, e a razão é a mesma nas duas:
   *
   * 1. **Campos de cartão** (número, validade, CVV). O checkout deste projeto é
   *    hospedado: o site coleta identificação e consentimento, cria o pedido e
   *    manda para a página do provedor, que é quem vê o cartão. Copiar os
   *    campos criaria escopo de PCI que o projeto não tem — e o próprio
   *    protótipo diz, na nota de integração, que ali é o ponto de plugar o
   *    gateway real. O passo 2 explica onde o pagamento acontece.
   * 2. **"Ambiente de demonstração — nenhuma cobrança real é feita."** No
   *    protótipo é verdade; aqui a cobrança é real. Manter a frase seria a pior
   *    espécie de tela que mente.
   */
  const garantias = [
    'Acesso imediato após a confirmação',
    co.certificateAvailable ? 'Certificado digital incluso' : '',
    'Direito de arrependimento em 7 dias',
  ]
    .filter(Boolean)
    .map((t) => `<div><span class="ok" aria-hidden="true">✓</span><span>${esc(t)}</span></div>`)
    .join('');

  const resumo = `
    <aside class="ck-resumo">
      <h2>Sua matrícula</h2>
      ${
        forSale
          ? `<div class="ck-itens">
               <div class="ck-item">
                 <span class="nome">${esc(co.title)}</span>
                 <span class="valor">${esc(co.priceFormatted || '')}</span>
               </div>
             </div>
             <div class="ck-total">
               <span class="rotulo">Total</span>
               <span class="valor">${esc(co.priceFormatted || '')}</span>
             </div>
             ${
               co.installmentFormatted
                 ? `<div style="text-align:right;color:var(--ink-soft);font-size:13px;margin-top:4px">ou ${co.installments}x de ${esc(co.installmentFormatted)}</div>`
                 : ''
             }
             <div class="ck-garantias">${garantias}</div>`
          : `<p style="color:var(--ink-soft);font-size:14px">Este curso ainda não tem matrícula online. Fale com a gente pelo WhatsApp.</p>`
      }
    </aside>`;

  const form = forSale
    ? formularioCheckout({ tipo: 'curso', slug: co.slug })
    : `<div class="ck-coluna"><div class="ck-bloco">
         <h2>Matrícula por atendimento</h2>
         <p style="color:var(--ink-soft);font-size:15px;line-height:1.6;margin-bottom:20px">
           Este curso ainda não está com matrícula online. Fale com a nossa equipe e a gente
           conduz sua matrícula pelos canais oficiais.
         </p>
         <a class="btn btn-wa" href="${ORG.whatsapp}" rel="noopener nofollow">${ICONE_WHATSAPP} Falar no WhatsApp</a>
       </div></div>`;

  const body = html`
    <section class="ck-wrap">
      <nav class="ck-trilha" aria-label="Trilha">
        <a href="/">Início</a> / <a href="/formacoes">Cursos</a> /
        <a href="/formacao/${co.slug}">${co.shortTitle}</a> / <span class="atual">Checkout</span>
      </nav>
      <h1>Finalizar matrícula</h1>
      <p class="ck-sub">${co.title}</p>
      <div class="ck-layout">${raw(form)} ${raw(resumo)}</div>
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
