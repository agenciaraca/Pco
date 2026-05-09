// Tests dos novos webhook events (sprint 561):
// certificate.issued, payment.failed, course.published.

import { describe, it, expect } from 'vitest';
import {
  formatSlack,
  formatDiscord,
  formatTeams,
  formatTelegram,
  formatMattermost,
} from '../server/webhooks/formatters';
import { ALL_WEBHOOK_EVENTS } from '../server/webhooks/types';

const baseInput = (event: 'certificate.issued' | 'payment.failed' | 'course.published') => ({
  event,
  data: { foo: 'bar' },
  deliveryId: 'del-x',
  ts: '2026-05-09T10:00:00.000Z',
});

describe('ALL_WEBHOOK_EVENTS', () => {
  it('inclui os 3 novos events', () => {
    expect(ALL_WEBHOOK_EVENTS).toContain('certificate.issued');
    expect(ALL_WEBHOOK_EVENTS).toContain('payment.failed');
    expect(ALL_WEBHOOK_EVENTS).toContain('course.published');
  });
  it('total de 10 events', () => {
    expect(ALL_WEBHOOK_EVENTS.length).toBe(10);
  });
});

describe('format Slack — novos events', () => {
  it('certificate.issued tem titulo certo + emoji', () => {
    const out = formatSlack(baseInput('certificate.issued')) as {
      text: string;
      blocks: Array<{ text?: { text: string } }>;
    };
    expect(out.text).toContain('Certificado emitido');
    expect(out.text).toContain('📜');
  });
  it('payment.failed tem warning emoji', () => {
    const out = formatSlack(baseInput('payment.failed')) as { text: string };
    expect(out.text).toContain('Pagamento falhou');
    expect(out.text).toContain('⚠');
  });
  it('course.published tem rocket emoji', () => {
    const out = formatSlack(baseInput('course.published')) as { text: string };
    expect(out.text).toContain('Curso publicado');
    expect(out.text).toContain('🚀');
  });
});

describe('format Discord — novos events tem cor padrao', () => {
  it('certificate.issued color default azul', () => {
    const out = formatDiscord(baseInput('certificate.issued')) as {
      embeds: Array<{ color: number; title: string }>;
    };
    expect(out.embeds[0].color).toBe(0x0070f3);
    expect(out.embeds[0].title).toContain('Certificado emitido');
  });
  it('payment.failed mantem default (sem cor especial — caller pode customizar)', () => {
    const out = formatDiscord(baseInput('payment.failed')) as {
      embeds: Array<{ color: number }>;
    };
    expect(out.embeds[0].color).toBe(0x0070f3);
  });
});

describe('format Teams — novos events themeColor', () => {
  it('payment.failed mantem azul default (nao eh order.* então não cai nos cases)', () => {
    const out = formatTeams(baseInput('payment.failed')) as { themeColor: string };
    expect(out.themeColor).toBe('0070F3');
  });
  it('course.published mantem azul default', () => {
    const out = formatTeams(baseInput('course.published')) as { themeColor: string };
    expect(out.themeColor).toBe('0070F3');
  });
});

describe('format Telegram — novos events title', () => {
  it('certificate.issued', () => {
    const out = formatTelegram(baseInput('certificate.issued'), '1') as {
      text: string;
    };
    expect(out.text).toContain('Certificado emitido');
  });
});

describe('format Mattermost — novos events', () => {
  it('payment.failed', () => {
    const out = formatMattermost(baseInput('payment.failed')) as { text: string };
    expect(out.text).toContain('Pagamento falhou');
  });
});
