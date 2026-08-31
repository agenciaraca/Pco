/**
 * Tags de marketing — Google, Meta e a verificação de propriedade dos sites.
 *
 * ## Por que existe
 *
 * Até 31/ago/2026 **não havia onde cadastrar isso**. O dono procurou o lugar de
 * colocar credencial e tag de Google e Meta e não achou, porque o lugar não
 * tinha sido construído: a tela de integrações listava o Google Analytics como
 * *inexistente*, e não como "não conectado" — a diferença é entre "falta alguém
 * configurar" e "não há o que configurar". A medição de tráfego do painel é
 * própria, sem cookie e sem IP, e não depende de nada disto; mas anúncio pago
 * precisa de pixel para medir conversão, e é isso que faltava.
 *
 * ## A decisão que vale registrar: guardamos IDENTIFICADOR, nunca script
 *
 * A tentação óbvia seria um campo "cole aqui o código do Google". Isso seria um
 * buraco de XSS com aparência de recurso: qualquer conta de admin comprometida
 * passaria a executar JavaScript arbitrário em toda página do site, para todo
 * visitante, sem deixar rastro no repositório.
 *
 * Então: cada campo aceita **só o identificador**, validado por formato
 * (`GTM-…`, `G-…`, dígitos), e **o servidor monta o trecho**. Não há caminho
 * pelo qual um texto colado no admin vire tag `<script>` no navegador de alguém.
 *
 * ## Consentimento não é enfeite
 *
 * Carregar pixel de terceiro antes do "aceito" contraria o que a própria
 * política de privacidade do site promete. Por isso `exigirConsentimento`
 * nasce `true`: as tags só sobem depois do aceite, e o aceite é registrado no
 * navegador de quem visita — não aqui.
 */

import { JsonStore } from '../db/json-store';

export interface TagsMarketing {
  /** Google Tag Manager — `GTM-XXXXXXX`. Quando presente, é o único carregado. */
  gtmId: string;
  /** Google Analytics 4 — `G-XXXXXXXXXX`. Ignorado se houver GTM. */
  ga4Id: string;
  /** Pixel do Meta (Facebook/Instagram) — só dígitos. */
  metaPixelId: string;
  /** Conteúdo da meta `google-site-verification` (Search Console). */
  googleSiteVerification: string;
  /** Conteúdo da meta `facebook-domain-verification`. */
  facebookDomainVerification: string;
  /** Tags só sobem depois do aceite de cookies. Padrão: sim. */
  exigirConsentimento: boolean;
  /** Interruptor geral: desliga tudo sem apagar o que foi cadastrado. */
  ativo: boolean;
  updatedAt: string;
}

const PADRAO: TagsMarketing = {
  gtmId: '',
  ga4Id: '',
  metaPixelId: '',
  googleSiteVerification: '',
  facebookDomainVerification: '',
  exigirConsentimento: true,
  ativo: true,
  updatedAt: new Date(0).toISOString(),
};

const store = new JsonStore<TagsMarketing>('marketing-tags.json', () => [{ ...PADRAO }]);

/**
 * Cópia em memória, para quem precisa da configuração de forma síncrona — o
 * middleware de CSP roda em toda requisição e não pode esperar disco.
 * É atualizada no boot (primeira leitura) e a cada gravação.
 */
let cache: TagsMarketing = { ...PADRAO };

export async function getTags(): Promise<TagsMarketing> {
  const todas = await store.getAll();
  if (todas.length === 0) {
    await store.setAll([{ ...PADRAO }]);
    cache = { ...PADRAO };
    return { ...PADRAO };
  }
  // Registro antigo pode não ter campo novo — mesclar com o padrão evita
  // `undefined` chegando no HTML como a palavra "undefined".
  const atual = { ...PADRAO, ...todas[0]! };
  cache = atual;
  return atual;
}

export async function updateTags(patch: Partial<TagsMarketing>): Promise<TagsMarketing> {
  const atual = await getTags();
  const proximo: TagsMarketing = {
    ...atual,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await store.setAll([proximo]);
  cache = proximo;
  return proximo;
}

/** Leitura síncrona do que já foi carregado. Nunca faz I/O. */
export function tagsEmCache(): TagsMarketing {
  return cache;
}

/** Alguma tag configurada e ligada? */
export function temTag(t: TagsMarketing = cache): boolean {
  return t.ativo && Boolean(t.gtmId || t.ga4Id || t.metaPixelId);
}

/**
 * Hosts que a CSP precisa liberar — e **apenas** os do que está configurado.
 *
 * Liberar googletagmanager e facebook para sempre, "por via das dúvidas",
 * deixaria a política mais frouxa mesmo quando ninguém usa nada disso. Sem tag
 * cadastrada, a CSP continua exatamente como era.
 */
export function hostsParaCsp(t: TagsMarketing = cache): {
  script: string[];
  img: string[];
  connect: string[];
  frame: string[];
} {
  const script: string[] = [];
  const img: string[] = [];
  const connect: string[] = [];
  const frame: string[] = [];
  if (!t.ativo) return { script, img, connect, frame };

  if (t.gtmId || t.ga4Id) {
    script.push('https://www.googletagmanager.com');
    img.push('https://www.googletagmanager.com', 'https://www.google-analytics.com');
    connect.push(
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      'https://region1.google-analytics.com',
    );
    if (t.gtmId) frame.push('https://www.googletagmanager.com');
  }
  if (t.metaPixelId) {
    script.push('https://connect.facebook.net');
    img.push('https://www.facebook.com');
    connect.push('https://www.facebook.com');
  }
  return { script, img, connect, frame };
}
