// Tests dos novos presets (telegram, teams, mattermost) — sprint 542.

import { describe, it, expect } from 'vitest';
import { WEBHOOK_PRESETS, findPreset } from '../server/webhooks/presets';

describe('webhook presets — telegram/teams/mattermost', () => {
  it('telegram preset existe com headers contendo X-Telegram-Chat-Id', () => {
    const p = findPreset('telegram');
    expect(p).not.toBeNull();
    expect(p!.channelType).toBe('telegram');
    expect(p!.headers).toEqual({ 'X-Telegram-Chat-Id': '<CHAT_ID>' });
    expect(p!.urlPlaceholder).toContain('api.telegram.org');
  });

  it('teams preset existe com URL outlook', () => {
    const p = findPreset('teams');
    expect(p).not.toBeNull();
    expect(p!.channelType).toBe('teams');
    expect(p!.urlPlaceholder).toContain('outlook.office.com');
  });

  it('mattermost preset existe com channelType correto', () => {
    const p = findPreset('mattermost');
    expect(p).not.toBeNull();
    expect(p!.channelType).toBe('mattermost');
    expect(p!.urlPlaceholder).toContain('/hooks/');
  });

  it('todos os presets têm icon e urlPlaceholder', () => {
    for (const p of WEBHOOK_PRESETS) {
      expect(p.icon, `preset ${p.id} sem icon`).toBeTruthy();
      expect(p.urlPlaceholder, `preset ${p.id} sem urlPlaceholder`).toBeTruthy();
    }
  });

  it('todos os ids são únicos', () => {
    const ids = WEBHOOK_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('count de presets >= 10', () => {
    expect(WEBHOOK_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
});
