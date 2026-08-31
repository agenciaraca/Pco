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
import { ORG, AUTHOR_IS_PLACEHOLDER, ENDERECO_PEDAGOGICO, PRIVACIDADE_RESUMO } from './config';
import { PUBLIC_CSS_SERVIDO } from './styles';

/** Resultado de um template hono/html (síncrono ou assíncrono). */
export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface NavItem {
  label: string;
  href: string;
  key: string;
}
/**
 * O menu do site — seis destinos, nesta ordem, e ela não é arbitrária.
 *
 * 1. **Cursos** abre a porta larga: é o que a maioria veio buscar, e a primeira
 *    posição é a mais vista de qualquer menu.
 * 2. **Psicanálise Clínica** dá porta direta ao carro-chefe. Quem já sabe o
 *    nome não deveria precisar passar pela lista.
 * 3. **Nosso AVA** responde "o que eu recebo depois de pagar" — sustenta a
 *    decisão que os dois primeiros abriram.
 * 4. **Blog** atrai quem ainda não decide nada; importa para a busca, mas está
 *    fora do caminho de compra.
 * 5. **Sobre** é a checagem de credibilidade, feita instantes antes de decidir.
 * 6. **Contato** fecha porque a última posição é a segunda mais vista, e é onde
 *    procura quem já decidiu — e quem travou.
 *
 * "Início" não é item: o logotipo leva para casa, como em todo site.
 *
 * O rótulo é **Cursos** e o endereço continua `/formacoes`. São coisas
 * diferentes de propósito: "cursos" é como as pessoas falam, e `/formacoes` é o
 * que a busca já conhece — trocar a URL jogaria fora o histórico dela.
 */
export const NAV: NavItem[] = [
  { label: 'Cursos', href: '/formacoes', key: 'cursos' },
  {
    label: 'Psicanálise Clínica',
    href: '/formacao/curso-de-psicanalise-clinica-online',
    key: 'carro-chefe',
  },
  { label: 'Nosso AVA', href: '/ava-pco', key: 'ava' },
  { label: 'Blog', href: '/blog', key: 'blog' },
  { label: 'Sobre', href: '/sobre', key: 'sobre' },
  { label: 'Contato', href: '/contato', key: 'contato' },
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

/**
 * Ícone oficial do WhatsApp. Existe como SVG e não como glifo (`✆`) porque o
 * glifo é um telefone genérico: quem bate o olho não reconhece o canal, e em
 * fonte sem esse caractere vira um quadrado vazio.
 */
export const ICONE_WHATSAPP = raw(
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">' +
    '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/>' +
    '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23z"/>' +
    '</svg>',
);

/**
 * Ícone do carrinho — o mesmo traço do protótipo do cabeçalho
 * (`design pagina publicas pco/.../pages/SiteHeader.dc.html`). Pela mesma razão
 * do WhatsApp acima: aqui havia o emoji `🛒`, que cada sistema desenha de um
 * jeito, e num deles nem colore. Ícone de compra não pode variar com a máquina
 * de quem visita.
 */
export const ICONE_CARRINHO = raw(
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
    '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
);

/**
 * Divisor "pincel": três curvas longas e assimétricas do mesmo tom, em
 * opacidades crescentes, que dissolvem o corte reto entre duas seções.
 *
 * `cor` é o **fundo da seção seguinte** — é isso que faz o divisor parecer a
 * própria seção avançando. Passar a cor da seção atual desenha uma faixa solta
 * no lugar de uma transição.
 *
 * A seção que o recebe precisa de `position:relative`, `overflow:hidden` e
 * espaço embaixo — a classe `.tem-pincel` já traz os três.
 */
export function pincel(cor: string, opts: { topo?: boolean } = {}): Html {
  const classe = opts.topo ? 'pincel-topo' : 'pincel';
  return html`<div class="${classe}" aria-hidden="true">
    <svg viewBox="0 0 1440 150" preserveAspectRatio="none" fill="${cor}">
      <path
        opacity=".3"
        d="M0,70 C320,10 660,120 1020,52 C1210,18 1350,44 1440,72 L1440,151 L0,151 Z"
      />
      <path
        opacity=".5"
        d="M0,94 C300,44 640,132 1000,80 C1200,52 1350,76 1440,58 L1440,151 L0,151 Z"
      />
      <path d="M0,114 C310,72 640,146 1010,100 C1210,76 1350,96 1440,84 L1440,151 L0,151 Z" />
    </svg>
  </div>`;
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

/**
 * Cabeçalho do site — o mesmo do `/ava-pco`, e é essa a questão.
 *
 * Até 30/ago/2026 havia dois: este, branco, com a letra ψ dentro de um
 * quadradinho; e o do aplicativo, com o degradê da marca e a logomarca de
 * verdade. Duas identidades no mesmo domínio, e a troca entre elas era a
 * primeira coisa que o olho comparava ao mudar de página — a sensação de "isto
 * é outra empresa" começava aqui, antes de qualquer conteúdo.
 *
 * Agora os dois lados usam o degradê `--brand-gradient`, o arquivo
 * `/logo-pco-dark.png` (branco, feito para fundo escuro) com 36px de altura, e
 * a mesma régua de 64px.
 */
function header(active?: string): Html {
  return html`
    <header class="site-header">
      <div class="wrap bar">
        <a class="brand" href="/" aria-label="${ORG.shortName} — página inicial">
          <img src="/logo-pco-dark.png" alt="${ORG.name}" width="150" height="36" />
        </a>
        <nav class="nav" id="site-nav" aria-label="Principal">
          ${raw(
            NAV.map(
              (n) =>
                `<a href="${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${n.label}</a>`,
            ).join(''),
          )}
          <a class="nav-entrar" href="/login">Entrar</a>
          <a class="nav-cta" href="/formacoes">Matricular-se</a>
        </nav>
        <div class="header-cta">
          <a class="cart-link" href="/carrinho" aria-label="Carrinho">
            ${raw(ICONE_CARRINHO)}
            <span class="cart-badge" data-count="0" aria-hidden="true">0</span>
          </a>
          <button class="btn-topo" data-theme-toggle type="button" aria-label="Alternar tema">
            ◐
          </button>
          <a class="btn btn-topo-cheio" href="/login">Entrar</a>
          <a class="btn btn-cta btn-topo-cta" href="/formacoes">Matricular-se</a>
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

/**
 * Separador ondulado entre blocos do rodapé. Traço fino, não uma linha reta —
 * acompanha a linguagem do divisor "pincel" das seções.
 */
function ondinha(): Html {
  return html`<svg
    class="ondinha"
    viewBox="0 0 120 8"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M0,4 C15,0 25,8 40,4 C55,0 65,8 80,4 C95,0 105,8 120,4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.2"
    />
  </svg>`;
}

/** Um telefone com ícone e link direto para a conversa. */
function linhaWhatsapp(numero: string): Html {
  const digitos = numero.replace(/\D/g, '');
  return html`<a class="rodape-contato" href="https://wa.me/55${digitos}" rel="noopener nofollow"
    >${ICONE_WHATSAPP}<span>${numero}</span></a
  >`;
}

function footer(): Html {
  const year = new Date().getFullYear();
  const comercial = ORG.address;
  const pedag = ENDERECO_PEDAGOGICO;

  // A coluna de privacidade só existe quando há texto de verdade para ela.
  // Sem isso, a grade cai para duas colunas em vez de deixar um vão.
  const temPrivacidade = PRIVACIDADE_RESUMO !== null && PRIVACIDADE_RESUMO.length > 0;

  return html`
    ${pincel('var(--brand-grad-topo)', { topo: true })}
    <footer class="site-footer">
      <div class="wrap cols${raw(temPrivacidade ? '' : ' cols-2')}">
        <div class="rodape-col">
          <div class="brand" style="color:#fff;margin-bottom:14px;justify-content:center">
            <span class="mark" aria-hidden="true">ψ</span><span>${ORG.shortName}</span>
          </div>
          ${raw(ORG.phones.map((t) => linhaWhatsapp(t)).join(''))}
          <a class="rodape-contato" href="mailto:${ORG.email}">${ORG.email}</a>
          ${ondinha()}
          <p class="rodape-rotulo">Comercial</p>
          <p class="rodape-endereco">
            ${comercial.street}<br />${comercial.city}-${comercial.region} CEP
            ${comercial.postalCode}
          </p>
          <p class="rodape-rotulo">${pedag.rotulo}</p>
          <p class="rodape-endereco">
            ${pedag.street}<br />${pedag.city} – ${pedag.region} CEP ${pedag.postalCode}
          </p>
          ${raw(ORG.cnpj ? `<p class="rodape-endereco">CNPJ ${ORG.cnpj}</p>` : '')}
        </div>

        <div class="rodape-col">
          <div class="selo-rntp" aria-hidden="true">
            <span>RNTP</span>
            <small>REGISTRO NACIONAL<br />DE TERAPEUTAS</small>
          </div>
          ${ondinha()}
          <p class="rodape-endereco" style="font-weight:700">${ORG.rntp ?? ''}</p>
          <p class="rodape-endereco" style="font-style:italic">Escola Reconhecida RNTP</p>
        </div>

        ${raw(
          temPrivacidade
            ? `<div class="rodape-col rodape-privacidade">
                 <p class="rodape-priv-titulo">Política de Privacidade:</p>
                 ${PRIVACIDADE_RESUMO!.map((par) => `<p>${par}</p>`).join('')}
                 <p><a class="link-destaque" href="/privacidade">Política de Privacidade completa</a></p>
               </div>`
            : '',
        )}
      </div>
      <div class="wrap legal">
        <span>© ${ORG.founded ?? 2018}–${year} ${ORG.name}. Todos os direitos reservados.</span>
        <span
          ><a href="/termos">Termos</a> ·
          <a class="link-destaque" href="/privacidade">Política de Privacidade</a></span
        >
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
        <meta name="theme-color" content="#0097b2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a5f6e" media="(prefers-color-scheme: dark)" />
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
          ${raw(PUBLIC_CSS_SERVIDO)}
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
