// Sanitização leve de HTML pra renderizar conteúdo de aulas importadas do WP/LD.
// Whitelist de tags + atributos seguros. Remove <script>, event handlers, javascript: URLs.
// Permite iframes de YouTube/Vimeo (audio/video embed).
//
// NÃO É UM DOMPURIFY — para casos com input não-confiável de usuário use lib real.
// Aqui o input vem do nosso WP de origem (confiável), por isso uma whitelist
// estrita já basta.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sup', 'sub', 'mark',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a',
  'img',
  'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'span', 'div',
  'iframe',
  'audio', 'source',
]);

// Atributos permitidos por tag (whitelist). Outros são removidos.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  iframe: new Set([
    'src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'title',
  ]),
  audio: new Set(['controls', 'src']),
  source: new Set(['src', 'type']),
  table: new Set(['border']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

const IFRAME_ALLOWED_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'soundcloud.com',
];

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return true;
}

function isAllowedIframeSrc(url: string): boolean {
  try {
    const u = new URL(url, 'https://example.com');
    return IFRAME_ALLOWED_HOSTS.includes(u.host);
  } catch {
    return false;
  }
}

/**
 * Sanitiza um pedaço de HTML usando DOMParser do browser.
 * Retorna HTML seguro para `dangerouslySetInnerHTML`.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // No SSR não tem DOMParser — só usa no client. Se for chamado server-side, devolve a string crua (sem render).
  if (typeof DOMParser === 'undefined') return '';

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return '';

  cleanNode(root);
  return root.innerHTML;
}

function cleanNode(node: Element): void {
  // Itera reverso para poder remover sem quebrar índice
  const children = Array.from(node.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Remove a tag mas mantém o conteúdo (unwrap)
      while (child.firstChild) {
        node.insertBefore(child.firstChild, child);
      }
      node.removeChild(child);
      continue;
    }
    cleanAttrs(child, tag);
    cleanNode(child);
  }
}

function cleanAttrs(el: Element, tag: string): void {
  const allowed = ALLOWED_ATTRS[tag];
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    const name = attr.name.toLowerCase();
    // Remove event handlers (onclick, onerror, etc) e style
    if (name.startsWith('on') || name === 'style') {
      el.removeAttribute(attr.name);
      continue;
    }
    if (!allowed || !allowed.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }
    // Validações específicas
    if (name === 'href' || name === 'src') {
      const url = attr.value;
      if (!isSafeUrl(url)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (tag === 'iframe' && name === 'src' && !isAllowedIframeSrc(url)) {
        el.removeAttribute(attr.name);
        continue;
      }
    }
  }
  // Links externos: força target=_blank + rel
  if (tag === 'a' && el.getAttribute('href')) {
    if (!el.getAttribute('target')) el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  }
}
