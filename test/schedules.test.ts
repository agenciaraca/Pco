// Testes para o cálculo de próxima execução de schedules de import.

import { describe, it, expect } from 'vitest';
import { computeNextRun } from '../server/imports/schedules-store';

describe('computeNextRun', () => {
  describe('daily', () => {
    it('retorna hoje se ainda não passou', () => {
      // Now = 2025-05-04 02:00 UTC. Schedule = 03:00 UTC daily.
      const now = new Date('2025-05-04T02:00:00.000Z');
      const next = computeNextRun(
        { frequency: 'daily', hourUtc: 3, minute: 0 },
        now,
      );
      expect(next.toISOString()).toBe('2025-05-04T03:00:00.000Z');
    });

    it('retorna amanhã se já passou', () => {
      // Now = 2025-05-04 04:00 UTC. Schedule = 03:00 UTC daily.
      const now = new Date('2025-05-04T04:00:00.000Z');
      const next = computeNextRun(
        { frequency: 'daily', hourUtc: 3, minute: 0 },
        now,
      );
      expect(next.toISOString()).toBe('2025-05-05T03:00:00.000Z');
    });

    it('respeita minute', () => {
      const now = new Date('2025-05-04T02:00:00.000Z');
      const next = computeNextRun(
        { frequency: 'daily', hourUtc: 3, minute: 30 },
        now,
      );
      expect(next.toISOString()).toBe('2025-05-04T03:30:00.000Z');
    });
  });

  describe('weekly', () => {
    it('retorna próxima segunda às 4h UTC', () => {
      // 2025-05-04 é domingo. Schedule = segunda 04:00 UTC.
      const now = new Date('2025-05-04T10:00:00.000Z'); // domingo 10h UTC
      const next = computeNextRun(
        { frequency: 'weekly', hourUtc: 4, minute: 0, weekday: 1 },
        now,
      );
      expect(next.toISOString()).toBe('2025-05-05T04:00:00.000Z'); // segunda
      expect(next.getUTCDay()).toBe(1);
    });

    it('avança 7 dias se hoje é o weekday e horário já passou', () => {
      // 2025-05-05 é segunda. Schedule = segunda 04:00 UTC. Now = segunda 06:00 UTC.
      const now = new Date('2025-05-05T06:00:00.000Z');
      const next = computeNextRun(
        { frequency: 'weekly', hourUtc: 4, minute: 0, weekday: 1 },
        now,
      );
      expect(next.toISOString()).toBe('2025-05-12T04:00:00.000Z');
    });

    it('mesma segunda se horário ainda não passou', () => {
      // 2025-05-05 segunda 02:00. Schedule = segunda 04:00.
      const now = new Date('2025-05-05T02:00:00.000Z');
      const next = computeNextRun(
        { frequency: 'weekly', hourUtc: 4, minute: 0, weekday: 1 },
        now,
      );
      expect(next.toISOString()).toBe('2025-05-05T04:00:00.000Z');
    });

    it('retorna próximo sábado quando weekday=6', () => {
      // 2025-05-04 domingo. Schedule = sábado 03:00 UTC.
      const now = new Date('2025-05-04T10:00:00.000Z');
      const next = computeNextRun(
        { frequency: 'weekly', hourUtc: 3, minute: 0, weekday: 6 },
        now,
      );
      expect(next.getUTCDay()).toBe(6);
      expect(next.toISOString()).toBe('2025-05-10T03:00:00.000Z');
    });
  });
});
