/**
 * Layout do site público: shell HTML + <head> (SEO/GEO/CWV) + header/footer
 * compartilhados. Renderiza no servidor (SSR) via hono/html — HTML completo já
 * pronto para crawler e LLM, sem depender de JS (progressive enhancement).
 *
 * CWV/PageSpeed: CSS crítico inline (sem request), zero webfont, JS same-origin
 * com defer (não bloqueia render), imagens com dimensão explícita nas páginas.
 */
import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { ORG, AUTHOR_IS_PLACEHOLDER } from './config';
import { PUBLIC_CSS } from './styles';

/** Resultado de um template hono/html (síncrono ou assíncrono). */
export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface NavItem {
  label: string;
  href: string;
  key: string;
}
export const NAV: NavItem[] = [
  { label: 'Início', href: '/', key: 'home' },
  { label: 'Cursos', href: '/formacoes', key: 'cursos' },
  { label: 'Blog', href: '/blog', key: 'blog' },
  { label: 'Sobre', href: '/sobre', key: 'sobre' },
  { label: 'Contato', href: '/contato', key: 'contato' },
  // A landing original do AVA (SPA) vira um item de menu.
  { label: 'Nosso AVA', href: '/ava-pco', key: 'ava' },
];

export interface PageOptions {
  title: string;
  description: string;
  /** Caminho canônico, ex. '/sobre'. */
  path: string;
  bodyHtml: Html | string;
  jsonLd?: Array<Record<string, unknown> | null>;
  noindex?: boolean;
  ogImage?: string;
  ogType?: string;
  activeNav?: string;
}

function jsonLdTags(blocks: Array<Record<string, unknown> | null> = []): Html {
  const valid = blocks.filter((b): b is Record<string, unknown> => b != null);
  // JSON.stringify seguro dentro de <script type="application/ld+json">:
  // escapa apenas '<' para evitar quebra de tag.
  return html`${raw(
    valid
      .map(
        (b) =>
          `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`,
      )
      .join('\n'),
  )}`;
}

function header(active?: string): Html {
  return html`
    <header class="site-header">
      <div class="wrap bar">
        <a class="brand" href="/" aria-label="${ORG.shortName} — início">
          <span class="mark" aria-hidden="true">ψ</span>
          <span>${ORG.shortName}</span>
        </a>
        <nav class="nav" id="site-nav" aria-label="Principal">
          ${raw(
            NAV.map(
              (n) =>
                `<a href="${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${n.label}</a>`,
            ).join(''),
          )}
        </nav>
        <div class="header-cta">
          <a class="cart-link" href="/carrinho" aria-label="Carrinho">
            <span aria-hidden="true">🛒</span>
            <span class="cart-badge" data-count="0" aria-hidden="true">0</span>
          </a>
          <button
            class="btn btn-outline"
            data-theme-toggle
            type="button"
            aria-label="Alternar tema"
            style="padding:9px 14px"
          >
            ◐
          </button>
          <a class="btn btn-primary" href="/login" style="padding:10px 20px">Entrar</a>
          <button
            class="menu-toggle"
            data-menu-toggle
            type="button"
            aria-label="Menu"
            aria-expanded="false"
            aria-controls="site-nav"
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  `;
}

function footer(): Html {
  const year = 2026;
  return html`
    <footer class="site-footer">
      <div class="wrap cols">
        <div>
          <div class="brand" style="color:#fff;margin-bottom:12px">
            <span class="mark" aria-hidden="true">ψ</span><span>${ORG.shortName}</span>
          </div>
          <p style="color:#cfe0dc;font-size:14.5px;max-width:34ch">${ORG.slogan}</p>
          <p style="color:#9fc0ba;font-size:12.5px;margin-top:14px">
            ${ORG.rntp ?? ''} · desde ${ORG.founded ?? ''}
          </p>
        </div>
        <div>
          <h4>Navegar</h4>
          <ul>
            ${raw(NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join(''))}
            ${raw(AUTHOR_IS_PLACEHOLDER ? '' : '<li><a href="/autor">Responsável técnico</a></li>')}
          </ul>
        </div>
        <div>
          <h4>Contato</h4>
          <ul>
            <li>
              <a href="${ORG.whatsapp}" rel="noopener nofollow">WhatsApp: ${ORG.phones[0]}</a>
            </li>
            <li><a href="mailto:${ORG.email}">${ORG.email}</a></li>
            <li>${ORG.address.city} · ${ORG.address.region}</li>
          </ul>
        </div>
      </div>
      <div class="wrap legal">
        <span>© ${year} ${ORG.legalName}${ORG.cnpj ? ' · CNPJ ' + ORG.cnpj : ''}</span>
        <span><a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a></span>
      </div>
    </footer>
  `;
}

export function renderPage(o: PageOptions): Html {
  const canonical = ORG.url + (o.path === '/' ? '' : o.path);
  const robots = o.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
  const ogImage = o.ogImage ?? ORG.url + ORG.logo;
  const ogType = o.ogType ?? 'website';
  return html`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${o.title}</title>
        <meta name="description" content="${o.description}" />
        <link rel="canonical" href="${canonical}" />
        <meta name="robots" content="${robots}" />
        <meta name="theme-color" content="#0f6e66" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a2f2c" media="(prefers-color-scheme: dark)" />
        <meta property="og:type" content="${ogType}" />
        <meta property="og:site_name" content="${ORG.name}" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:title" content="${o.title}" />
        <meta property="og:description" content="${o.description}" />
        <meta property="og:url" content="${canonical}" />
        <meta property="og:image" content="${ogImage}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${o.title}" />
        <meta name="twitter:description" content="${o.description}" />
        <meta name="twitter:image" content="${ogImage}" />
        <link rel="icon" href="/favicon.ico" />
        <style>
          ${raw(PUBLIC_CSS)}
        </style>
        ${jsonLdTags(o.jsonLd)}
      </head>
      <body>
        <a class="skip" href="#main">Pular para o conteúdo</a>
        ${header(o.activeNav)}
        <main id="main">${o.bodyHtml}</main>
        ${footer()}
        <a
          class="wa-float"
          href="${ORG.whatsapp}"
          rel="noopener nofollow"
          aria-label="Falar no WhatsApp"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2"
            />
          </svg>
        </a>
        <script src="/_pub/site.js" defer></script>
      </body>
    </html>`;
}
