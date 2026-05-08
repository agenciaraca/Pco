// Tests do provider Twilio (mock fetch).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { twilioMessagingProvider } from '../server/messaging/providers/twilio';
import { MessagingProviderError } from '../server/messaging/providers/types';
import type { MessagingConfig } from '../server/messaging/types';

const baseConfig: MessagingConfig = {
  id: 'cfg-twilio',
  provider: 'twilio',
  enabled: true,
  fromNumber: '+15551234567',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('twilio messaging provider', () => {
  describe('send', () => {
    it('exige AccountSid', async () => {
      await expect(
        twilioMessagingProvider.send(baseConfig, { apiKey: 'tok' }, {
          to: '+5511999999999',
          body: 'oi',
        }),
      ).rejects.toBeInstanceOf(MessagingProviderError);
    });
    it('exige AuthToken', async () => {
      await expect(
        twilioMessagingProvider.send(
          baseConfig,
          { accountSid: 'ACfake' },
          { to: '+5511999999999', body: 'oi' },
        ),
      ).rejects.toThrow(/token/i);
    });
    it('rejeita destinatario fora do E.164', async () => {
      await expect(
        twilioMessagingProvider.send(
          baseConfig,
          { accountSid: 'ACx', apiKey: 't' },
          { to: '11999999999', body: 'oi' },
        ),
      ).rejects.toThrow(/E\.?164/);
    });

    it('faz POST x-www-form-urlencoded com Basic auth', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ sid: 'SMabc', status: 'queued' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const r = await twilioMessagingProvider.send(
        baseConfig,
        { accountSid: 'ACtest', apiKey: 'token' },
        { to: '+5511999999999', body: 'Olá' },
      );
      expect(r.providerId).toBe('twilio');
      expect(r.externalId).toBe('SMabc');
      expect(r.status).toBe('queued');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(
        'https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json',
      );
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe(
        `Basic ${Buffer.from('ACtest:token').toString('base64')}`,
      );
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      const body = (init as RequestInit).body as string;
      expect(body).toContain('From=%2B15551234567');
      expect(body).toContain('To=%2B5511999999999');
      expect(body).toContain('Body=Ol%C3%A1');
    });

    it('trunca body em 1600 chars', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 201 }),
      );
      const big = 'x'.repeat(2000);
      await twilioMessagingProvider.send(
        baseConfig,
        { accountSid: 'AC', apiKey: 't' },
        { to: '+5511999999999', body: big },
      );
      const body = ((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string;
      const params = new URLSearchParams(body);
      expect(params.get('Body')!.length).toBe(1600);
    });

    it('lança em HTTP non-2xx', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 }),
      );
      await expect(
        twilioMessagingProvider.send(
          baseConfig,
          { accountSid: 'AC', apiKey: 't' },
          { to: '+5511999999999', body: 'oi' },
        ),
      ).rejects.toThrow(/403/);
    });

    it('mapeia status failed do twilio para failed', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ sid: 'SM1', status: 'failed' }), {
          status: 200,
        }),
      );
      const r = await twilioMessagingProvider.send(
        baseConfig,
        { accountSid: 'AC', apiKey: 't' },
        { to: '+5511999999999', body: 'oi' },
      );
      expect(r.status).toBe('failed');
    });
  });

  describe('ping', () => {
    it('200 → ok', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );
      const r = await twilioMessagingProvider.ping!(baseConfig, {
        accountSid: 'AC',
        apiKey: 't',
      });
      expect(r.ok).toBe(true);
    });
    it('401 → credenciais invalidas', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 401 }),
      );
      const r = await twilioMessagingProvider.ping!(baseConfig, {
        accountSid: 'AC',
        apiKey: 't',
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/inv/i);
    });
    it('falha sem creds', async () => {
      const r = await twilioMessagingProvider.ping!(baseConfig, {});
      expect(r.ok).toBe(false);
    });
  });
});
