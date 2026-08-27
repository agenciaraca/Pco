/**
 * De onde vêm os números da tela de métricas.
 *
 * **Até 27/ago/2026 a resposta era "de lugar nenhum".** O que saía daqui era a
 * semente de `src/app/data/seed.ts`, e a tela mostrava aquilo com cara de
 * medição — um admin podia olhar "52% de tráfego orgânico" e decidir investir
 * em SEO com base em ficção.
 *
 * Agora existe medição própria: `server/analytics/` conta as páginas abertas
 * no site, sem cookie, sem IP e sem Google Analytics. `fonteDasMetricas()`
 * deixou de ser um aviso fixo e passou a responder o que de fato há — inclusive
 * "estou medindo, mas ainda não há histórico", que é o estado do primeiro dia e
 * não pode ser confundido nem com ficção nem com tráfego zero.
 *
 * O que continua **sem fonte** é a parte que depende do Search Console:
 * posição em busca, volume de pesquisa e CTR. Esses números não são estimados
 * aqui — a tela some com a tabela em vez de inventá-la.
 */

import { primeiroDia } from '../analytics/traffic-store';
import type { KeywordMetric, SeoMetric } from '../../src/app/types/schema';
import { montaRelatorio, normalizaRange } from '../analytics/relatorio';

export type FonteMetricas = 'propria' | 'sem-historico' | 'google-analytics' | 'search-console';

export interface StatusMetricas {
  fonte: FonteMetricas;
  /** `true` quando os números vêm de medição real — ainda que ela seja curta. */
  conectado: boolean;
  /** Primeiro dia medido. `null` = a medição começou e nada foi visto ainda. */
  medindoDesde: string | null;
  /** O que a tela não tem como mostrar, e por quê. */
  semFonte: Array<{ o_que: string; depende_de: string }>;
  observacao: string;
}

const SEM_FONTE: StatusMetricas['semFonte'] = [
  {
    o_que: 'Palavras-chave: posição, volume de busca e CTR',
    depende_de: 'Google Search Console (credencial do dono)',
  },
  {
    o_que: 'Páginas indexadas e score de SEO',
    depende_de: 'Google Search Console (credencial do dono)',
  },
];

export async function fonteDasMetricas(): Promise<StatusMetricas> {
  const desde = await primeiroDia();
  if (desde === null) {
    return {
      fonte: 'sem-historico',
      conectado: true,
      medindoDesde: null,
      semFonte: SEM_FONTE,
      observacao:
        'A medição própria está ligada, mas nenhuma visita foi registrada ainda. Os números abaixo são zero de verdade — não são estimativa nem demonstração.',
    };
  }
  return {
    fonte: 'propria',
    conectado: true,
    medindoDesde: desde,
    semFonte: SEM_FONTE,
    observacao: `Medição própria do servidor, sem cookie e sem IP, desde ${desde}. Navegação em /admin não é contada.`,
  };
}

/**
 * A série que a tela consome. Mantém o formato antigo (`SeoMetric`) de
 * propósito: o contrato público não muda, só a procedência dos números.
 */
export async function listSeoTimeseries(range = '30d'): Promise<SeoMetric[]> {
  const rel = await montaRelatorio(normalizaRange(range));
  return rel.serie;
}

/**
 * Sem Search Console, não há palavra-chave para listar. Devolver lista vazia é
 * a resposta correta: a semente antiga devolvia dez termos com posição e
 * volume que ninguém mediu.
 */
export async function listKeywords(): Promise<KeywordMetric[]> {
  return [];
}
