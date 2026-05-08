// Mock provider — registra mensagens em memoria pra testes/dev.
// Nao envia nada real.

import type { MessagingProviderImpl } from './types';

const sent: Array<{ to: string; body: string; ts: string }> = [];

export const mockMessagingProvider: MessagingProviderImpl = {
  async send(_config, _creds, input) {
    sent.push({ to: input.to, body: input.body, ts: new Date().toISOString() });
    return {
      providerId: 'mock',
      externalId: `mock-${sent.length}`,
      status: 'sent',
    };
  },
  async ping() {
    return { ok: true, message: 'mock ok' };
  },
};

export function listMockMessages(): ReadonlyArray<{ to: string; body: string; ts: string }> {
  return sent;
}

export function resetMockMessages(): void {
  sent.length = 0;
}
