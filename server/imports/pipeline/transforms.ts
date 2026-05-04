// Transformações de campo aplicáveis durante o mapping.
// Cada transform recebe o valor (sempre string vinda de CSV ou unknown vindo de API)
// e retorna um valor processado.

export type TransformFn = (value: unknown, ctx?: Record<string, unknown>) => unknown;

const transforms: Record<string, TransformFn> = {
  trim: (v) => (typeof v === 'string' ? v.trim() : v),
  lowercase: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  uppercase: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  titlecase: (v) =>
    typeof v === 'string'
      ? v
          .toLowerCase()
          .split(/\s+/)
          .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
          .join(' ')
      : v,

  parse_date: (v) => {
    if (typeof v !== 'string' || !v) return null;
    // Aceita ISO 8601, YYYY-MM-DD, DD/MM/YYYY
    const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return new Date(v).toISOString();
    const dmy = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`).toISOString();
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  },

  parse_datetime: (v) => transforms.parse_date!(v),

  parse_money: (v) => {
    if (typeof v === 'number') return Math.round(v * 100);
    if (typeof v !== 'string' || !v) return 0;
    // R$ 1.234,56 → 123456 cents | 1,234.56 → 123456 cents | 199.90 → 19990 cents
    const cleaned = v
      .replace(/[R$\s]/g, '')
      .replace(/\.(?=\d{3}([,\.]|$))/g, '') // remove pontos de milhar
      .replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? Math.round(num * 100) : 0;
  },

  parse_boolean: (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'sim';
    }
    return Boolean(v);
  },

  parse_int: (v) => {
    if (typeof v === 'number') return Math.trunc(v);
    if (typeof v !== 'string' || !v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  },

  parse_float: (v) => {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string' || !v) return null;
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  },

  split_pipe: (v) => (typeof v === 'string' && v ? v.split('|').map((s) => s.trim()) : []),
  split_comma: (v) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()) : []),
  split_semicolon: (v) =>
    typeof v === 'string' && v ? v.split(';').map((s) => s.trim()) : [],

  strip_html: (v) => {
    if (typeof v !== 'string') return v;
    return v.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  },

  /**
   * Sanitização HTML básica — allowlist de tags seguras.
   * Não substitui DOMPurify, mas evita scripts e attrs perigosos para conteúdo importado.
   */
  sanitize_html: (v) => {
    if (typeof v !== 'string') return v;
    // Remove <script>, <style>, <iframe>, <object>, <embed> e seus conteúdos
    let s = v.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Remove tags não-allowlist (mantém só p, br, strong, em, h1-6, ul, ol, li, a, img, blockquote, code, pre)
    const ALLOW = /^(p|br|strong|em|b|i|u|h[1-6]|ul|ol|li|a|img|blockquote|code|pre)$/i;
    s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_full, tag: string, attrs: string) => {
      if (!ALLOW.test(tag)) return '';
      // Limpa atributos perigosos
      const clean = attrs.replace(
        /\s*(on\w+|javascript:|data:text\/html)[^=]*=("[^"]*"|'[^']*'|\S+)/gi,
        '',
      );
      return `<${tag}${clean}>`;
    });
    return s.trim();
  },

  extract_video_url: (v) => {
    if (typeof v !== 'string') return v;
    // Pega primeira URL de vídeo (vimeo/youtube/mp4)
    const m = v.match(
      /(https?:\/\/[^\s"<>]+\.(mp4|webm|m4v)|https?:\/\/(player\.)?vimeo\.com\/[^\s"<>]+|https?:\/\/(www\.)?youtube\.com\/[^\s"<>]+|https?:\/\/youtu\.be\/[^\s"<>]+)/i,
    );
    return m?.[1] ?? v;
  },

  normalize_phone: (v) => {
    if (typeof v !== 'string') return v;
    return v.replace(/[^\d+]/g, '');
  },

  normalize_document: (v) => {
    if (typeof v !== 'string') return v;
    return v.replace(/\D/g, '');
  },

  default_if_empty: (v, ctx) => {
    if (v === null || v === undefined || v === '') {
      return ctx?.default ?? null;
    }
    return v;
  },
};

export function listTransformNames(): string[] {
  return Object.keys(transforms);
}

export function applyTransforms(
  value: unknown,
  pipeline: string[] | undefined,
  ctx?: Record<string, unknown>,
): unknown {
  if (!pipeline || pipeline.length === 0) return value;
  let v: unknown = value;
  for (const name of pipeline) {
    const fn = transforms[name];
    if (!fn) continue; // ignora silenciosamente nomes desconhecidos
    v = fn(v, ctx);
  }
  return v;
}

/** Map de status WC → enrollment interno (default sensato). */
export const DEFAULT_WC_STATUS_MAP: Record<string, 'active' | 'pending' | 'expired' | 'cancelled' | 'completed'> = {
  completed: 'active',
  processing: 'pending',
  pending: 'pending',
  'on-hold': 'pending',
  cancelled: 'cancelled',
  refunded: 'cancelled',
  failed: 'cancelled',
  trash: 'cancelled',
};
