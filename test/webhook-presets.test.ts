import { describe, it, expect } from 'vitest';
import { WEBHOOK_PRESETS, findPreset } from '../server/webhooks/presets';
import { ALL_WEBHOOK_EVENTS } from '../server/webhooks/types';

describe('webhook presets', () => {
  it('inclui presets esperados (Slack, Discord, Zapier, n8n, Make, Pipedream, generic)', () => {
    const ids = WEBHOOK_PRESETS.map((p) => p.id);
    expect(ids).toContain('slack');
    expect(ids).toContain('discord');
    expect(ids).toContain('zapier');
    expect(ids).toContain('n8n');
    expect(ids).toContain('make');
    expect(ids).toContain('pipedream');
    expect(ids).toContain('generic');
  });

  it('todos têm name + description + urlPlaceholder + channelType', () => {
    for (const p of WEBHOOK_PRESETS) {
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.urlPlaceholder).toBeTruthy();
      expect([
        'generic',
        'slack',
        'discord',
        'telegram',
        'teams',
        'mattermost',
      ]).toContain(p.channelType);
    }
  });

  it('Slack/Discord usam channelType correto', () => {
    expect(findPreset('slack')?.channelType).toBe('slack');
    expect(findPreset('discord')?.channelType).toBe('discord');
  });

  it('automation tools (zapier/n8n/make) usam channelType=generic', () => {
    expect(findPreset('zapier')?.channelType).toBe('generic');
    expect(findPreset('n8n')?.channelType).toBe('generic');
    expect(findPreset('make')?.channelType).toBe('generic');
  });

  it('suggestedEvents usa apenas eventos válidos do catálogo', () => {
    for (const p of WEBHOOK_PRESETS) {
      for (const ev of p.suggestedEvents) {
        expect(ALL_WEBHOOK_EVENTS).toContain(ev);
      }
    }
  });

  it('findPreset retorna preset por ID', () => {
    const p = findPreset('zapier');
    expect(p).toBeTruthy();
    expect(p!.name).toBe('Zapier');
  });

  it('findPreset retorna null quando ID inválido', () => {
    expect(findPreset('inexistente')).toBeNull();
  });

  it('preset generic tem suggestedEvents vazio (admin define)', () => {
    expect(findPreset('generic')!.suggestedEvents).toEqual([]);
  });

  it('todos com docsUrl exceto generic', () => {
    for (const p of WEBHOOK_PRESETS) {
      if (p.id === 'generic') continue;
      expect(p.docsUrl).toMatch(/^https?:/);
    }
  });
});
