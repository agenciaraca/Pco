// Tests do formatter Pushover + preset (sprint 557).

import { describe, it, expect } from 'vitest';
import { formatPushover } from '../server/webhooks/formatters';
import { findPreset } from '../server/webhooks/presets';

const baseInput = {
  event: 'order.paid' as const,
  data: { orderId: 'ord-1', total: 199.9, customer: 'Maria' },
  deliveryId: 'del-42',
  ts: '2026-05-08T10:00:00.000Z',
};

describe('formatPushover', () => {
  it('inclui token + user dos headers extras', () => {
    const out = formatPushover(baseInput, 'app-token-x', 'user-key-y') as Record<
      string,
      unknown
    >;
    expect(out.token).toBe('app-token-x');
    expect(out.user).toBe('user-key-y');
  });

  it('title contem emoji + nome do evento', () => {
    const out = formatPushover(baseInput, 't', 'u') as { title: string };
    expect(out.title).toContain('Pedido pago');
    expect(out.title).toMatch(/^.{1,3}/); // emoji prefix
  });

  it('message tem campos do data joined', () => {
    const out = formatPushover(baseInput, 't', 'u') as { message: string };
    expect(out.message).toContain('orderId: ord-1');
    expect(out.message).toContain('total: 199.9');
    expect(out.message).toContain('customer: Maria');
  });

  it('priority 1 (high) para order.refunded', () => {
    const out = formatPushover(
      { ...baseInput, event: 'order.refunded' },
      't',
      'u',
    ) as { priority: number };
    expect(out.priority).toBe(1);
  });

  it('priority -1 (silent) para enrollment.created e lesson.completed', () => {
    expect(
      (formatPushover({ ...baseInput, event: 'enrollment.created' }, 't', 'u') as {
        priority: number;
      }).priority,
    ).toBe(-1);
    expect(
      (formatPushover({ ...baseInput, event: 'lesson.completed' }, 't', 'u') as {
        priority: number;
      }).priority,
    ).toBe(-1);
  });

  it('priority 0 (default) para outros eventos', () => {
    expect(
      (formatPushover({ ...baseInput, event: 'user.created' }, 't', 'u') as {
        priority: number;
      }).priority,
    ).toBe(0);
  });

  it('message limita 1024 chars', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 100; i++) big[`field${i}`] = 'x'.repeat(50);
    const out = formatPushover({ ...baseInput, data: big }, 't', 'u') as {
      message: string;
    };
    expect(out.message.length).toBeLessThanOrEqual(1024);
  });

  it('timestamp em segundos Unix', () => {
    const out = formatPushover(baseInput, 't', 'u') as { timestamp: number };
    expect(out.timestamp).toBe(Math.floor(new Date(baseInput.ts).getTime() / 1000));
  });

  it('aceita token/user undefined (envio falha mas formatter nao quebra)', () => {
    const out = formatPushover(baseInput) as Record<string, unknown>;
    expect(out.token).toBeUndefined();
    expect(out.user).toBeUndefined();
  });

  it('limita a 8 fields', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 20; i++) big[`f${i}`] = 'v';
    const out = formatPushover({ ...baseInput, data: big }, 't', 'u') as {
      message: string;
    };
    const lines = out.message.split('\n');
    expect(lines.length).toBeLessThanOrEqual(8);
  });
});

describe('pushover preset', () => {
  it('existe com headers obrigatorios', () => {
    const p = findPreset('pushover');
    expect(p).not.toBeNull();
    expect(p!.channelType).toBe('pushover');
    expect(p!.headers).toEqual({
      'X-Pushover-Token': '<APP_TOKEN>',
      'X-Pushover-User': '<USER_KEY_ou_GROUP_KEY>',
    });
    expect(p!.urlPlaceholder).toContain('pushover.net');
  });
});
