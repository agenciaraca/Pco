/**
 * O que está conectado ao AVA, de verdade.
 *
 * A aba "Integrações" de `/admin/configuracoes` mostrava uma lista fixa de
 * cinco nomes — Google Analytics, Search Console, Google Calendar, Stripe,
 * Mailgun/SES — todos com o selo "não conectado", escrito à mão no `.tsx`.
 *
 * Mentia nos dois sentidos. Dizia "Stripe: não conectado" mesmo com um gateway
 * Stripe ativo processando pagamento, e dizia "Mailgun/SES: não conectado" com
 * um provedor de e-mail configurado e testado. E listava Google Calendar, que
 * não existe no código — dar nome a uma integração inexistente sugere que
 * basta alguém ir lá conectar.
 *
 * Aqui cada linha vem de um registro. Três estados, e a diferença importa:
 *
 * - `conectado`  — há configuração ativa, e ela é usada.
 * - `disponivel` — o código existe, falta configurar.
 * - `inexistente`— não há integração no sistema. Some da lista de "conectar".
 */

import * as gatewaysRepo from '../payments/gateways-repo';
import * as emailConfigs from '../notifications/config-store';
import * as webhookEndpoints from '../webhooks/endpoints-store';
import * as aiConfigs from '../repositories/ai-configs';
import * as zoomConfig from '../live-sessions/zoom-config';
import { fonteDasMetricas } from '../repositories/metrics';

export type EstadoIntegracao = 'conectado' | 'disponivel' | 'inexistente';

export interface Integracao {
  id: string;
  nome: string;
  categoria: string;
  estado: EstadoIntegracao;
  /** O que está ligado, ou o que falta para ligar. Nunca vazio. */
  detalhe: string;
  /** Onde se configura, quando há onde. */
  ondeConfigurar?: string;
}

/** Tolera falha de um módulo sem derrubar a lista inteira. */
async function tenta<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function listarIntegracoes(): Promise<Integracao[]> {
  const [gateways, emails, endpoints, ias, zoom, metricas] = await Promise.all([
    tenta(() => gatewaysRepo.listAll(), []),
    tenta(() => emailConfigs.listConfigs(), []),
    tenta(() => webhookEndpoints.listEndpoints(), []),
    tenta(() => aiConfigs.listConfigs(), []),
    tenta(() => zoomConfig.getConfig(), null),
    tenta(() => fonteDasMetricas(), null),
  ]);

  const out: Integracao[] = [];

  // ---------- Pagamentos ----------
  // O mock não conta como conectado: ele existe para testar sem cobrar, e
  // marcá-lo como integração ativa esconderia que ninguém recebe dinheiro.
  const gwAtivos = gateways.filter((g) => g.active);
  const gwReais = gwAtivos.filter((g) => g.provider !== 'mock');
  out.push({
    id: 'pagamentos',
    nome: 'Gateway de pagamento',
    categoria: 'Pagamentos',
    estado: gwReais.length > 0 ? 'conectado' : 'disponivel',
    detalhe:
      gwReais.length > 0
        ? `Ativo: ${gwReais.map((g) => g.provider).join(', ')}`
        : gwAtivos.length > 0
          ? 'Só o gateway de teste (mock) está ativo — nenhuma cobrança real é processada.'
          : 'Nenhum gateway ativo. Stripe, Asaas, Pagar.me, MercadoPago e PayPal estão implementados.',
    ondeConfigurar: '/admin/gateways',
  });

  // ---------- E-mail ----------
  const emailAtivo = emails.find((c) => c.enabled && c.provider !== 'mock');
  out.push({
    id: 'email',
    nome: 'E-mail transacional',
    categoria: 'Comunicação',
    estado: emailAtivo ? 'conectado' : 'disponivel',
    detalhe: emailAtivo
      ? `Provedor: ${emailAtivo.provider}${
          emailAtivo.lastTestStatus ? ` · último teste: ${emailAtivo.lastTestStatus}` : ''
        }`
      : emails.length === 0
        ? 'Nenhuma configuração — nenhum aluno recebe e-mail.'
        : 'Só o provedor de teste (mock) está ligado — nada sai de verdade.',
    ondeConfigurar: '/admin/emails',
  });

  // ---------- IA ----------
  // Ativo **e com chave**. A semente cria configurações marcadas como ativas
  // sem credencial nenhuma; contá-las como conectadas diria que a IA está no
  // ar quando a primeira chamada vai falhar.
  const iaAtiva = ias.filter((c) => c.active && c.apiKeyConfigured);
  const iaSemChave = ias.filter((c) => c.active && !c.apiKeyConfigured);
  out.push({
    id: 'ia',
    nome: 'Provedor de IA',
    categoria: 'Inteligência artificial',
    estado: iaAtiva.length > 0 ? 'conectado' : 'disponivel',
    detalhe:
      iaAtiva.length > 0
        ? `${iaAtiva.length} configuração(ões) ativa(s): ${[
            ...new Set(iaAtiva.map((c) => c.provider)),
          ].join(', ')}`
        : iaSemChave.length > 0
          ? `${iaSemChave.length} configuração(ões) ativa(s) sem chave de API — a primeira chamada falharia.`
          : 'Nenhuma configuração ativa. Anthropic, OpenAI, Google, Mistral, DeepSeek e Groq estão implementados.',
    ondeConfigurar: '/admin/ias',
  });

  // ---------- Webhooks de saída ----------
  const whAtivos = endpoints.filter((e) => e.enabled);
  out.push({
    id: 'webhooks',
    nome: 'Webhooks de saída',
    categoria: 'Integrações',
    estado: whAtivos.length > 0 ? 'conectado' : 'disponivel',
    detalhe:
      whAtivos.length > 0
        ? `${whAtivos.length} destino(s) ativo(s)`
        : 'Nenhum destino ativo. Slack, Discord, Telegram, Teams, Mattermost, Pushover e genérico estão implementados.',
    ondeConfigurar: '/admin/webhooks',
  });

  // ---------- Videoconferência ----------
  out.push({
    id: 'zoom',
    nome: 'Zoom (sessões ao vivo)',
    categoria: 'Aulas ao vivo',
    estado: zoom && zoom.enabled ? 'conectado' : 'disponivel',
    detalhe:
      zoom && zoom.enabled
        ? 'Configurado e habilitado.'
        : 'Não configurado. O código existe; falta a credencial.',
    ondeConfigurar: '/admin/sessoes-ao-vivo',
  });

  // ---------- Métricas ----------
  out.push({
    id: 'analytics',
    nome: 'Medição de tráfego',
    categoria: 'Métricas',
    estado: 'conectado',
    detalhe:
      metricas?.observacao ??
      'Medição própria do servidor, sem cookie e sem IP. Não depende de terceiros.',
    ondeConfigurar: '/admin/metricas',
  });

  out.push({
    id: 'search-console',
    nome: 'Google Search Console',
    categoria: 'Métricas',
    estado: 'disponivel',
    detalhe:
      'Não conectado. É o que falta para posição em busca, volume de pesquisa, CTR e páginas indexadas — os únicos números que a tela de métricas declara não medir.',
  });

  // ---------- O que NÃO existe ----------
  // Listado como inexistente, e não como "não conectado": a diferença é entre
  // "falta alguém configurar" e "não há o que configurar". A lista antiga
  // trazia Google Analytics e Google Calendar como se bastasse ir lá ligar.
  out.push({
    id: 'google-analytics',
    nome: 'Google Analytics',
    categoria: 'Métricas',
    estado: 'inexistente',
    detalhe:
      'Não há integração com o GA no código, e não é falta: a medição de tráfego é própria, sem cookie e sem enviar dado de visitante para terceiro.',
  });

  out.push({
    id: 'google-calendar',
    nome: 'Google Calendar',
    categoria: 'Agenda',
    estado: 'inexistente',
    detalhe:
      'Não há integração com o Google Calendar no código. Agendamento de sessão vive só no AVA.',
  });

  return out;
}
