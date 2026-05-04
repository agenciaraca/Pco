// Formatadores de payload por tipo de canal.
// Slack: blocks. Discord: embeds. Generic: JSON cru do AVA.

import type { WebhookEventType } from './types';

interface FormatterInput {
  event: WebhookEventType;
  data: Record<string, unknown>;
  deliveryId: string;
  ts: string;
}

const COLORS_HEX: Record<string, number> = {
  paid: 0x10b981,
  refunded: 0xf59e0b,
  canceled: 0x6b7280,
  default: 0x0070f3,
};

function eventTitle(event: WebhookEventType): string {
  switch (event) {
    case 'order.paid':
      return 'Pedido pago';
    case 'order.canceled':
      return 'Pedido cancelado';
    case 'order.refunded':
      return 'Pedido reembolsado';
    case 'enrollment.created':
      return 'Matrícula criada';
    case 'user.created':
      return 'Usuário criado';
    case 'course.completed':
      return 'Curso concluído';
    case 'lesson.completed':
      return 'Aula concluída';
    default:
      return event;
  }
}

function eventEmoji(event: WebhookEventType): string {
  switch (event) {
    case 'order.paid':
      return '✅';
    case 'order.canceled':
      return '❌';
    case 'order.refunded':
      return '↩️';
    case 'enrollment.created':
      return '🎓';
    case 'user.created':
      return '👤';
    case 'course.completed':
      return '🏆';
    case 'lesson.completed':
      return '🎯';
    default:
      return '🔔';
  }
}

export function formatGeneric(input: FormatterInput): unknown {
  return {
    id: input.deliveryId,
    event: input.event,
    created: input.ts,
    data: input.data,
  };
}

export function formatSlack(input: FormatterInput): unknown {
  const title = `${eventEmoji(input.event)} AVA PCO — ${eventTitle(input.event)}`;
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [];
  for (const [k, v] of Object.entries(input.data)) {
    fields.push({
      type: 'mrkdwn',
      text: `*${k}:*\n${formatValueShort(v)}`,
    });
    if (fields.length >= 8) break;
  }
  return {
    text: title,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: title.slice(0, 150), emoji: true },
      },
      { type: 'section', fields: fields.length > 0 ? fields.slice(0, 10) : undefined },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `delivery: \`${input.deliveryId}\` · ${new Date(input.ts).toLocaleString('pt-BR')}`,
          },
        ],
      },
    ].filter((b) => !('fields' in b) || (b.fields?.length ?? 0) > 0),
  };
}

export function formatDiscord(input: FormatterInput): unknown {
  const title = `${eventEmoji(input.event)} ${eventTitle(input.event)}`;
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  for (const [k, v] of Object.entries(input.data)) {
    fields.push({
      name: k.slice(0, 250),
      value: formatValueShort(v).slice(0, 1000) || '—',
      inline: true,
    });
    if (fields.length >= 25) break;
  }
  let color = COLORS_HEX.default;
  if (input.event === 'order.paid') color = COLORS_HEX.paid!;
  else if (input.event === 'order.refunded') color = COLORS_HEX.refunded!;
  else if (input.event === 'order.canceled') color = COLORS_HEX.canceled!;

  return {
    embeds: [
      {
        title: title.slice(0, 250),
        description: `Evento \`${input.event}\` recebido em ${new Date(input.ts).toLocaleString('pt-BR')}`,
        color,
        fields: fields.length > 0 ? fields : undefined,
        footer: { text: `delivery: ${input.deliveryId}` },
      },
    ],
  };
}

function formatValueShort(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.slice(0, 200);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v).slice(0, 200);
  } catch {
    return String(v).slice(0, 200);
  }
}
