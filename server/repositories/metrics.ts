/**
 * Métricas de SEO.
 *
 * **Estes números são de demonstração.** Não há fonte de analytics conectada:
 * o que sai daqui é a semente de `src/app/data/seed.ts`, e sempre foi. O
 * comentário dizia isso desde o início, mas a tela do admin não dizia nada — e
 * número com cara de medição é o pior lugar para esconder que não se mediu
 * nada. Um admin pode olhar "52% de tráfego orgânico" e decidir investir em SEO
 * com base em ficção.
 *
 * `fonteDasMetricas()` existe para que a tela consiga avisar sem adivinhar. No
 * dia em que Google Analytics ou Search Console entrarem, é o único ponto que
 * muda: quem consome já sabe perguntar.
 */

import { seoTimeseries as seedSeo, keywords as seedKeywords } from '../../src/app/data/seed';
import type { SeoMetric, KeywordMetric } from '../../src/app/types/schema';

export type FonteMetricas = 'demo' | 'google-analytics' | 'search-console';

export interface StatusMetricas {
  fonte: FonteMetricas;
  /** `false` enquanto os números não vierem de medição real. */
  conectado: boolean;
  observacao: string;
}

export function fonteDasMetricas(): StatusMetricas {
  // Quando houver integração, decidir aqui pela configuração — e não pela
  // ausência de erro, que é o jeito de voltar a mentir sem perceber.
  return {
    fonte: 'demo',
    conectado: false,
    observacao:
      'Nenhuma fonte de analytics conectada. Os números desta tela são de demonstração e não refletem o tráfego real do site.',
  };
}

export async function listSeoTimeseries(_range = '30d'): Promise<SeoMetric[]> {
  return seedSeo;
}

export async function listKeywords(): Promise<KeywordMetric[]> {
  return seedKeywords;
}
