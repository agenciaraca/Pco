// Tests dos formatters Telegram, Teams e Mattermost (sprint 542).

import { describe, it, expect } from 'vitest';
import {
  formatTelegram,
  formatTeams,
  formatMattermost,
} from '../server/webhooks/formatters';

const baseInput = {
  event: 'order.paid' as const,
  data: { orderId: 'ord-1', total: 199.9, customer: 'Maria' },
  deliveryId: 'del-42',
  ts: '2026-05-08T10:00:00.000Z',
};

describe('formatTelegram', () => {
  it('inclui chat_id quando passado', () => {
    const out = formatTelegram(baseInput, '123456') as Record<string, unknown>;
    expect(out.chat_id).toBe('123456');
    expect(out.parse_mode).toBe('HTML');
    expect(out.disable_web_page_preview).toBe(true);
  });

  it('escapa HTML em valores', () => {
    const out = formatTelegram(
      { ...baseInput, data: { x: '<script>' } },
      '1',
    ) as { text: string };
    expect(out.text).toContain('&lt;script&gt;');
    expect(out.text).not.toContain('<script>');
  });

  it('inclui titulo do evento e delivery id', () => {
    const out = formatTelegram(baseInput, '1') as { text: string };
    expect(out.text).toContain('Pedido pago');
    expect(out.text).toContain('del-42');
  });

  it('limita texto a 4096 chars', () => {
    const huge = 'x'.repeat(8000);
    const out = formatTelegram(
      { ...baseInput, data: { big: huge } },
      '1',
    ) as { text: string };
    expect(out.text.length).toBeLessThanOrEqual(4096);
  });

  it('aceita ausencia de chat_id (admin pode mandar via query)', () => {
    const out = formatTelegram(baseInput) as Record<string, unknown>;
    expect(out.chat_id).toBeUndefined();
  });
});

describe('formatTeams', () => {
  it('retorna MessageCard schema', () => {
    const out = formatTeams(baseInput) as Record<string, unknown>;
    expect(out['@type']).toBe('MessageCard');
    expect(out['@context']).toBe('https://schema.org/extensions');
    expect(out.title).toContain('Pedido pago');
  });

  it('escolhe themeColor verde para order.paid', () => {
    const out = formatTeams(baseInput) as { themeColor: string };
    expect(out.themeColor).toBe('10B981');
  });

  it('themeColor laranja para refunded', () => {
    const out = formatTeams({
      ...baseInput,
      event: 'order.refunded',
    }) as { themeColor: string };
    expect(out.themeColor).toBe('F59E0B');
  });

  it('inclui facts limitados a 15', () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < 30; i++) data[`f${i}`] = `v${i}`;
    const out = formatTeams({ ...baseInput, data }) as {
      sections: Array<{ facts: unknown[] }>;
    };
    expect(out.sections[0].facts.length).toBe(15);
  });
});

describe('formatMattermost', () => {
  it('retorna text + attachments', () => {
    const out = formatMattermost(baseInput) as {
      text: string;
      attachments: Array<{ color: string; fields: unknown[] }>;
    };
    expect(out.text).toContain('Pedido pago');
    expect(out.text).toContain('del-42');
    expect(out.attachments?.[0].color).toBe('#10B981');
    expect(out.attachments?.[0].fields.length).toBe(3);
  });

  it('omite attachments quando data vazio', () => {
    const out = formatMattermost({ ...baseInput, data: {} }) as Record<
      string,
      unknown
    >;
    expect(out.attachments).toBeUndefined();
  });

  it('cor cinza para canceled', () => {
    const out = formatMattermost({
      ...baseInput,
      event: 'order.canceled',
    }) as { attachments: Array<{ color: string }> };
    expect(out.attachments[0].color).toBe('#6B7280');
  });
});
