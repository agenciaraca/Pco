// Presets curados pra integrações comuns. Admin escolhe um preset e o
// formulário é pré-preenchido com URL placeholder, headers, channelType
// e eventos sugeridos.
//
// Cada preset é puramente declarativo — não faz fetch nem valida URLs.
// O admin ainda precisa colar o webhook URL real do serviço.

import type { WebhookEventType } from './types';

export interface WebhookPreset {
  /** Slug imutável usado como ID. */
  id: string;
  name: string;
  /** Descrição curta exibida abaixo do nome. */
  description: string;
  /** Logo emoji ou nome do ícone (opcional, frontend pode ignorar). */
  icon?: string;
  /** URL placeholder com instrução. */
  urlPlaceholder: string;
  /** ChannelType correspondente (define o body format). */
  channelType: 'generic' | 'slack' | 'discord';
  /** Headers adicionais que o serviço espera. */
  headers?: Record<string, string>;
  /** Eventos sugeridos pra esse preset (admin pode mudar). */
  suggestedEvents: WebhookEventType[];
  /** Documentação externa: como obter o URL no serviço. */
  docsUrl?: string;
  /** Notas extras pro admin. */
  notes?: string;
}

export const WEBHOOK_PRESETS: WebhookPreset[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Posta mensagem em canal Slack via incoming webhook.',
    icon: '🔵',
    urlPlaceholder: 'https://hooks.slack.com/services/T.../B.../...',
    channelType: 'slack',
    suggestedEvents: ['order.paid', 'user.created', 'enrollment.created'],
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    notes:
      'Crie um app em api.slack.com → Incoming Webhooks → Add New Webhook to Workspace.',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Posta mensagem em canal Discord via webhook do servidor.',
    icon: '🟣',
    urlPlaceholder: 'https://discord.com/api/webhooks/.../...',
    channelType: 'discord',
    suggestedEvents: ['order.paid', 'user.created'],
    docsUrl:
      'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
    notes: 'No servidor: Configurações do canal → Integrações → Webhooks.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Conecta a qualquer um dos 5000+ apps do Zapier via webhook trigger.',
    icon: '⚡',
    urlPlaceholder: 'https://hooks.zapier.com/hooks/catch/.../...',
    channelType: 'generic',
    suggestedEvents: ['order.paid', 'user.created', 'course.completed'],
    docsUrl: 'https://help.zapier.com/hc/en-us/articles/8496288690701',
    notes:
      'Crie um Zap começando com "Webhooks by Zapier" → "Catch Hook" → cole o URL gerado.',
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Self-hosted automation. Use o nó Webhook como trigger.',
    icon: '🟧',
    urlPlaceholder: 'https://seu-n8n.com/webhook/abc-123',
    channelType: 'generic',
    suggestedEvents: ['order.paid', 'user.created'],
    docsUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/',
    notes:
      'No n8n: New Workflow → Webhook node → copie o URL "production" (não o test).',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Plataforma de automação visual. Use o módulo Webhook.',
    icon: '🟪',
    urlPlaceholder: 'https://hook.eu1.make.com/...',
    channelType: 'generic',
    suggestedEvents: ['order.paid', 'user.created'],
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
    notes: 'Em Scenarios: + → Webhooks → Custom webhook → Add → cole o URL.',
  },
  {
    id: 'pipedream',
    name: 'Pipedream',
    description: 'Workflows serverless via webhook source.',
    icon: '🟢',
    urlPlaceholder: 'https://eo.../m.pipedream.net',
    channelType: 'generic',
    suggestedEvents: ['order.paid', 'course.completed'],
    docsUrl: 'https://pipedream.com/docs/workflows/triggers/',
    notes: 'Crie workflow → HTTP / Webhook trigger → copie endpoint URL.',
  },
  {
    id: 'generic',
    name: 'Genérico (custom)',
    description: 'Qualquer endpoint HTTP que aceita POST JSON. Você define tudo.',
    icon: '⚙️',
    urlPlaceholder: 'https://seu-servico.com/webhook/...',
    channelType: 'generic',
    suggestedEvents: [],
    notes:
      'Recebe payload com {event, data, deliveryId, ts}. Verifique HMAC SHA-256 via header X-AVA-PCO-Signature.',
  },
];

export function findPreset(id: string): WebhookPreset | null {
  return WEBHOOK_PRESETS.find((p) => p.id === id) ?? null;
}
