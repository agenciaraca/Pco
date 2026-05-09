// Tests do computeStats do messaging log (sprint 563).
// Usa a versao pura (sem JsonStore) pra evitar flakiness com fs cache.

import { describe, it, expect } from 'vitest';
import {
  computeStats,
  type MessagingLogEntry,
} from '../server/messaging/log-store';

const NOW = new Date('2026-05-09T12:00:00Z');

function entry(
  status: 'sent' | 'queued' | 'failed',
  provider: 'mock' | 'twilio' | 'whatsapp-meta',
  ageMs: number,
): MessagingLogEntry {
  return {
    id: `e-${Math.random()}`,
    ts: new Date(NOW.getTime() - ageMs).toISOString(),
    provider,
    to: '+1',
    body: 'x',
    status,
  };
}

describe('computeStats', () => {
  it('vazio retorna zeros + 30 buckets vazios', () => {
    const s = computeStats([], NOW);
    expect(s.total).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.byDay.length).toBe(30);
    expect(s.byDay.every((d) => d.total === 0)).toBe(true);
    expect(s.byStatus).toEqual({ sent: 0, queued: 0, failed: 0 });
  });

  it('agrega por provider e status', () => {
    const s = computeStats(
      [
        entry('sent', 'mock', 0),
        entry('sent', 'twilio', 60_000),
        entry('failed', 'twilio', 60_000),
        entry('queued', 'whatsapp-meta', 0),
      ],
      NOW,
    );

    expect(s.total).toBe(4);
    expect(s.byProvider).toEqual({ mock: 1, twilio: 2, 'whatsapp-meta': 1 });
    expect(s.byStatus.sent).toBe(2);
    expect(s.byStatus.failed).toBe(1);
    expect(s.byStatus.queued).toBe(1);
    expect(s.successRate).toBe(75);
  });

  it('last24h vs last7d com cutoffs', () => {
    const s = computeStats(
      [
        entry('sent', 'mock', 0),
        entry('sent', 'mock', 23 * 60 * 60 * 1000),
        entry('sent', 'mock', 25 * 60 * 60 * 1000),
        entry('sent', 'mock', 8 * 24 * 60 * 60 * 1000),
      ],
      NOW,
    );
    expect(s.total).toBe(4);
    expect(s.last24h).toBe(2);
    expect(s.last7d).toBe(3);
  });

  it('byDay buckets sao ordenados e contam por status', () => {
    const s = computeStats(
      [
        entry('sent', 'mock', 0),
        entry('failed', 'mock', 60_000),
        entry('sent', 'mock', 24 * 60 * 60 * 1000),
      ],
      NOW,
    );
    const today = NOW.toISOString().slice(0, 10);
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const todayBucket = s.byDay.find((b) => b.day === today);
    const yesterdayBucket = s.byDay.find((b) => b.day === yesterday);
    expect(todayBucket).toBeDefined();
    expect(todayBucket!.total).toBe(2);
    expect(todayBucket!.sent).toBe(1);
    expect(todayBucket!.failed).toBe(1);
    expect(yesterdayBucket!.total).toBe(1);
    expect(yesterdayBucket!.sent).toBe(1);
    // Ordem cronologica
    const days = s.byDay.map((b) => b.day);
    expect([...days].sort()).toEqual(days);
  });

  it('successRate inclui queued + sent', () => {
    const s = computeStats(
      [
        entry('queued', 'mock', 0),
        entry('queued', 'mock', 0),
        entry('failed', 'mock', 0),
      ],
      NOW,
    );
    // 2/3 = 66.7
    expect(s.successRate).toBe(66.7);
  });

  it('ignora entries fora dos ultimos 30 dias no byDay', () => {
    const s = computeStats(
      [
        entry('sent', 'mock', 0),
        entry('sent', 'mock', 60 * 24 * 60 * 60 * 1000), // 60 dias
      ],
      NOW,
    );
    expect(s.total).toBe(2); // ambos contam no total
    const totalInBuckets = s.byDay.reduce((acc, b) => acc + b.total, 0);
    expect(totalInBuckets).toBe(1); // so o de hoje
  });
});
