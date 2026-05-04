// Mock provider — só loga. Útil em dev e como fallback.

import type { EmailProviderImpl } from './types';

export const mockProvider: EmailProviderImpl = {
  async send(_config, _creds, input) {
    const tos = Array.isArray(input.to) ? input.to : [input.to];
    // eslint-disable-next-line no-console
    console.log(
      `[email-mock] -> ${tos.map((t) => t.email).join(', ')} | ${input.subject} (${input.tag ?? '—'})`,
    );
    return {
      providerId: 'mock',
      externalId: `mock-${Date.now()}`,
      accepted: tos.length,
      rejected: 0,
    };
  },
  async ping() {
    return { ok: true, message: 'mock ok' };
  },
};
