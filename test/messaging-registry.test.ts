// Tests do registry de messaging providers.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALL_MESSAGING_PROVIDERS,
  getMessagingProvider,
} from '../server/messaging/providers/registry';
import { MessagingProviderError } from '../server/messaging/providers/types';
import {
  listMockMessages,
  resetMockMessages,
} from '../server/messaging/providers/mock';

beforeEach(() => {
  resetMockMessages();
});

describe('messaging providers registry', () => {
  it('lista mock + twilio + whatsapp-meta', () => {
    expect(ALL_MESSAGING_PROVIDERS).toEqual(['mock', 'twilio', 'whatsapp-meta']);
  });

  it('mock e twilio retornam impl com send + ping', () => {
    for (const id of ['mock', 'twilio'] as const) {
      const p = getMessagingProvider(id);
      expect(typeof p.send).toBe('function');
      expect(typeof p.ping).toBe('function');
    }
  });

  it('whatsapp-meta lança NOT_IMPLEMENTED', () => {
    expect(() => getMessagingProvider('whatsapp-meta')).toThrow(MessagingProviderError);
  });

  it('id desconhecido lança UNKNOWN_PROVIDER', () => {
    expect(() =>
      getMessagingProvider('foo' as unknown as Parameters<typeof getMessagingProvider>[0]),
    ).toThrow(/UNKNOWN_PROVIDER|desconhecido/);
  });

  it('mock provider grava mensagens em memoria', async () => {
    const p = getMessagingProvider('mock');
    await p.send(
      {
        id: 'c',
        provider: 'mock',
        enabled: true,
        fromNumber: '+1',
        createdAt: '',
        updatedAt: '',
      },
      {},
      { to: '+5511', body: 'hi' },
    );
    expect(listMockMessages()).toHaveLength(1);
    expect(listMockMessages()[0]).toMatchObject({ to: '+5511', body: 'hi' });
  });
});
