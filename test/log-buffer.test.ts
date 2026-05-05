import { describe, it, expect, beforeEach } from 'vitest';
import { installConsoleCapture, query, size } from '../server/monitoring/log-buffer';

describe('monitoring/log-buffer', () => {
  beforeEach(() => {
    installConsoleCapture();
  });

  it('captura console.log', () => {
    const before = size();
    console.log('test message ABC');
    const lines = query({ q: 'test message ABC' });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]?.message).toContain('test message ABC');
    expect(lines[0]?.level).toBe('log');
    expect(size()).toBeGreaterThan(before);
  });

  it('captura console.error com level=error', () => {
    console.error('SOME_ERROR_TAG_X', new Error('boom'));
    const lines = query({ level: 'error', q: 'SOME_ERROR_TAG_X' });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]?.level).toBe('error');
  });

  it('filtra por level', () => {
    console.warn('warn-marker-456');
    console.log('log-marker-456');
    const warns = query({ level: 'warn', q: 'marker-456' });
    expect(warns.every((l) => l.level === 'warn')).toBe(true);
  });

  it('limit aplicado', () => {
    for (let i = 0; i < 50; i++) console.log(`bulk-test-${i}`);
    const r = query({ q: 'bulk-test', limit: 10 });
    expect(r.length).toBeLessThanOrEqual(10);
  });

  it('mais recentes primeiro', () => {
    console.log('first-marker-AAA');
    console.log('second-marker-AAA');
    const r = query({ q: 'marker-AAA', limit: 5 });
    expect(r[0]?.message).toContain('second-marker-AAA');
  });
});
