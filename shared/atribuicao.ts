/**
 * De onde veio uma venda — o tipo e a leitura, compartilhados entre servidor e
 * tela.
 *
 * Fica em `shared/` porque as duas pontas precisam concordar no que é "canal":
 * o servidor grava, a tabela do admin mostra, e se cada lado inventasse o seu
 * resumo a mesma venda apareceria como "google" numa tela e "cpc" na outra.
 *
 * A captura e a normalização continuam no servidor (`server/marketing/
 * atribuicao.ts`), porque dependem de request e de política.
 */

/** O que se sabe sobre a origem de um pedido. Todo campo é opcional. */
export interface Atribuicao {
  /** Como a origem foi classificada: `utm`, `organic`, `referral`, `typein`, `admin`. */
  tipoOrigem?: string;
  /** `utm_source` — google, facebook, instagram… */
  origem?: string;
  /** `utm_medium` — cpc, organic, referral… */
  meio?: string;
  campanha?: string;
  conteudo?: string;
  termo?: string;
  idCampanha?: string;
  referrer?: string;
  dispositivo?: string;
  /** Primeira página da sessão que terminou em compra. */
  entrada?: string;
  /** Identificador de clique do Google Ads. */
  gclid?: string;
  /** Identificador de clique do Meta. */
  fbclid?: string;
}

export const CAMPOS_ATRIBUICAO: Array<keyof Atribuicao> = [
  'tipoOrigem', 'origem', 'meio', 'campanha', 'conteudo', 'termo',
  'idCampanha', 'referrer', 'dispositivo', 'entrada', 'gclid', 'fbclid',
];

export function temAtribuicao(a: Atribuicao | null | undefined): boolean {
  if (!a) return false;
  return CAMPOS_ATRIBUICAO.some((k) => {
    const v = a[k];
    return typeof v === 'string' && v.length > 0;
  });
}

/**
 * Uma linha só, para a tabela: o canal e a campanha.
 *
 * Devolve `null` quando não há o que dizer — é o que permite à coluna mostrar
 * travessão em vez de inventar "direto". Dos 1.845 pedidos importados, 1.125
 * não têm origem nenhuma; chamá-los de tráfego direto inflaria justamente o
 * canal mais fácil de superestimar.
 */
export function resumoDaOrigem(
  a: Atribuicao | null | undefined,
): { canal: string; detalhe: string | null } | null {
  if (!temAtribuicao(a)) return null;
  const at = a!;
  const canal =
    at.origem ??
    (at.gclid ? 'google' : at.fbclid ? 'meta' : null) ??
    (at.tipoOrigem === 'typein' ? 'direto' : null) ??
    (at.referrer ? dominioDe(at.referrer) : null) ??
    at.tipoOrigem ??
    'origem desconhecida';
  return { canal, detalhe: at.campanha ?? at.meio ?? null };
}

function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}
