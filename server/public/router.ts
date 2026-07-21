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
} from './jsonld';
import { PUBLIC_JS } from './client';

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
