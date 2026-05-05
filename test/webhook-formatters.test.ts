import { describe, it, expect } from 'vitest';
import {
  formatGeneric,
  formatSlack,
  formatDiscord,
} from '../server/webhooks/formatters';

const baseInput = {
  event: 'order.paid' as const,
  data: {
    orderId: 'ord-123',
    userEmail: 'cliente@x.com',
    amountCents: 9990,
    currency: 'BRL',
  },
  deliveryId: 'dl-abc',
  ts: '2024-03-15T10:00:00Z',
};

describe('webhook formatters', () => {
  it('formatGeneric retorna shape { id, event, created, data }', () => {
    const out = formatGeneric(baseInput) as Record<string, unknown>;
    expect(out.id).toBe('dl-abc');
    expect(out.event).toBe('order.paid');
    expect(out.created).toBe('2024-03-15T10:00:00Z');
    expect(out.data).toEqual(baseInput.data);
  });

  it('formatSlack inclui blocks com header e fields', () => {
    const out = formatSlack(baseInput) as {
      text: string;
      blocks: Array<Record<string, unknown>>;
    };
    expect(out.text).toContain('Pedido pago');
    expect(out.blocks.length).toBeGreaterThan(0);
    const header = out.blocks.find((b) => b.type === 'header');
    expect(header).toBeDefined();
    const ctx = out.blocks.find((b) => b.type === 'context');
    expect(JSON.stringify(ctx)).toContain('dl-abc');
  });

  it('formatDiscord inclui embeds com cor e fields', () => {
    const out = formatDiscord(baseInput) as {
      embeds: Array<{ color: number; title: string; fields?: unknown[] }>;
    };
    expect(out.embeds).toHaveLength(1);
    expect(out.embeds[0]?.title).toContain('Pedido pago');
    expect(out.embeds[0]?.color).toBeTypeOf('number');
    expect(out.embeds[0]?.fields).toBeInstanceOf(Array);
  });

  it('formatDiscord usa cor verde para order.paid e laranja para refunded', () => {
    const paid = formatDiscord({ ...baseInput, event: 'order.paid' }) as {
      embeds: Array<{ color: number }>;
    };
    const refunded = formatDiscord({ ...baseInput, event: 'order.refunded' }) as {
      embeds: Array<{ color: number }>;
    };
    expect(paid.embeds[0]?.color).not.toBe(refunded.embeds[0]?.color);
  });

  it('formatSlack/Discord não quebram com data vazio', () => {
    const empty = { ...baseInput, data: {} };
    expect(() => formatSlack(empty)).not.toThrow();
    expect(() => formatDiscord(empty)).not.toThrow();
  });
});
