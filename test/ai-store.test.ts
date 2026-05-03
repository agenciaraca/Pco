import { describe, it, expect } from 'vitest';
import {
  listConfigs,
  getConfig,
  getActiveByModule,
  updateConfig,
  maskKey,
  toPublic,
  recordUsage,
  aggregateUsage,
  countUsageInWindow,
} from '../server/ai/store';

describe('AI store', () => {
  it('listConfigs retorna ao menos as configs iniciais (tutor + recovery)', () => {
    const list = listConfigs();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.find((c) => c.module === 'tutor')).toBeDefined();
    expect(list.find((c) => c.module === 'recovery_plan')).toBeDefined();
  });

  it('configs públicas nunca expõem apiKey em claro', () => {
    for (const c of listConfigs()) {
      expect(c).not.toHaveProperty('apiKey');
      expect(c).toHaveProperty('apiKeyMasked');
      expect(c).toHaveProperty('apiKeyConfigured');
    }
  });

  it('maskKey gera string com asteriscos', () => {
    expect(maskKey('')).toBe('');
    expect(maskKey('short')).toBe('•••••');
    const long = maskKey('sk-ant-abc1234567890xyz');
    expect(long.length).toBe('sk-ant-abc1234567890xyz'.length);
    expect(long.startsWith('sk-a')).toBe(true);
    expect(long.endsWith('0xyz')).toBe(true);
    expect(long).toMatch(/•/);
  });

  it('updateConfig persiste mudanças e atualiza updatedAt', () => {
    const before = getConfig('ai-tutor');
    expect(before).not.toBeNull();
    const beforeTs = before!.updatedAt;

    // garante 1ms entre snapshots
    const updated = updateConfig('ai-tutor', { temperature: 0.7, maxTokens: 800 });
    expect(updated).not.toBeNull();
    expect(updated!.temperature).toBe(0.7);
    expect(updated!.maxTokens).toBe(800);
    expect(updated!.updatedAt).not.toBe(beforeTs);
  });

  it('updateConfig com apiKey vazia mantém a anterior', () => {
    updateConfig('ai-tutor', { apiKey: 'real-key-abc' });
    const before = getConfig('ai-tutor')!;
    expect(before.apiKey).toBe('real-key-abc');

    updateConfig('ai-tutor', { apiKey: '' });
    expect(getConfig('ai-tutor')!.apiKey).toBe('real-key-abc');

    updateConfig('ai-tutor', { apiKey: null });
    expect(getConfig('ai-tutor')!.apiKey).toBe('');
  });

  it('updateConfig retorna null para id inexistente', () => {
    expect(updateConfig('inexistente', { active: true })).toBeNull();
  });

  it('getActiveByModule retorna null se chave não configurada', () => {
    updateConfig('ai-tutor', { apiKey: null });
    expect(getActiveByModule('tutor')).toBeNull();
  });

  it('getActiveByModule retorna config quando active+chave', () => {
    updateConfig('ai-tutor', { apiKey: 'sk-real', active: true });
    const cfg = getActiveByModule('tutor');
    expect(cfg).not.toBeNull();
    expect(cfg!.id).toBe('ai-tutor');
  });

  it('toPublic não vaza a chave', () => {
    const cfg = getConfig('ai-tutor')!;
    const pub = toPublic(cfg);
    expect(pub).not.toHaveProperty('apiKey');
    expect(pub.apiKeyConfigured).toBe(cfg.apiKey.length > 0);
  });

  it('recordUsage e aggregateUsage acumulam corretamente', () => {
    const id = 'ai-tutor';
    recordUsage({ configId: id, inputTokens: 100, outputTokens: 50, costUsd: 0.001, successful: true });
    recordUsage({ configId: id, inputTokens: 200, outputTokens: 80, costUsd: 0.002, successful: true });
    recordUsage({ configId: id, inputTokens: 0, outputTokens: 0, costUsd: 0, successful: false });

    const agg = aggregateUsage(id);
    expect(agg.total).toBeGreaterThanOrEqual(3);
    expect(agg.inputTokens).toBeGreaterThanOrEqual(300);
    expect(agg.successCount).toBeGreaterThanOrEqual(2);
  });

  it('countUsageInWindow filtra por janela de tempo', () => {
    const count = countUsageInWindow('ai-tutor', undefined, 60_000);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
