// Tests do provider WhatsApp Cloud API (Meta) — mock fetch.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { whatsappMetaProvider } from '../server/messaging/providers/whatsapp-meta';
import { MessagingProviderError } from '../server/messaging/providers/types';
import type { MessagingConfig } from '../server/messaging/types';

const baseConfig: MessagingConfig = {
  id: 'cfg-wa',
  provider: 'whatsapp-meta',
  enabled: true,
  fromNumber: '+15551234567',
  whatsappPhoneNumberId: '123456789012345',
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

describe('whatsapp-meta provider', () => {
  describe('send', () => {
    it('exige access token', async () => {
      await expect(
        whatsappMetaProvider.send(baseConfig, {}, {
          to: '+5511999999999',
          body: 'oi',
        }),
      ).rejects.toBeInstanceOf(MessagingProviderError);
    });
    it('exige phoneNumberId', async () => {
      await expect(
        whatsappMetaProvider.send(
          { ...baseConfig, whatsappPhoneNumberId: undefined },
          { apiKey: 'tok' },
          { to: '+5511999999999', body: 'oi' },
        ),
      ).rejects.toThrow(/phone/i);
    });
    it('rejeita destinatario invalido', async () => {
      await expect(
        whatsappMetaProvider.send(
          baseConfig,
          { apiKey: 'tok' },
          { to: 'abc', body: 'oi' },
        ),
      ).rejects.toThrow(/E\.?164|numero/i);
    });

    it('faz POST /v18.0/{phone}/messages com Bearer e text payload', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ messages: [{ id: 'wamid.HBgL...' }] }),
          { status: 200 },
        ),
      );
      const r = await whatsappMetaProvider.send(
        baseConfig,
        { apiKey: 'EAAtoken' },
        { to: '+5511999999999', body: 'Olá' },
      );
      expect(r.providerId).toBe('whatsapp-meta');
      expect(r.externalId).toBe('wamid.HBgL...');
      expect(r.status).toBe('sent');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(
        'https://graph.facebook.com/v18.0/123456789012345/messages',
      );
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer EAAtoken');
      expect(headers['Content-Type']).toBe('application/json');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.messaging_product).toBe('whatsapp');
      // remove o '+' da E.164
      expect(body.to).toBe('5511999999999');
      expect(body.type).toBe('text');
      expect(body.text.body).toBe('Olá');
      expect(body.text.preview_url).toBe(false);
    });

    it('aceita to sem +', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      await whatsappMetaProvider.send(
        baseConfig,
        { apiKey: 't' },
        { to: '5511999999999', body: 'oi' },
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.to).toBe('5511999999999');
    });

    it('manda template quando whatsappTemplate informado', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      await whatsappMetaProvider.send(
        baseConfig,
        { apiKey: 't' },
        {
          to: '+5511999999999',
          body: 'fallback',
          whatsappTemplate: 'order_paid',
        },
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('order_paid');
      expect(body.template.language.code).toBe('pt_BR');
    });

    it('trunca body em 4096 chars', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      const big = 'x'.repeat(8000);
      await whatsappMetaProvider.send(
        baseConfig,
        { apiKey: 't' },
        { to: '+5511999999999', body: big },
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.text.body.length).toBe(4096);
    });

    it('lança em HTTP non-2xx', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{"error":{"message":"x"}}', { status: 401 }),
      );
      await expect(
        whatsappMetaProvider.send(
          baseConfig,
          { apiKey: 't' },
          { to: '+5511999999999', body: 'oi' },
        ),
      ).rejects.toThrow(/401/);
    });
  });

  describe('ping', () => {
    it('200 → ok', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );
      const r = await whatsappMetaProvider.ping!(baseConfig, { apiKey: 't' });
      expect(r.ok).toBe(true);
    });
    it('401 → token inválido', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 401 }),
      );
      const r = await whatsappMetaProvider.ping!(baseConfig, { apiKey: 't' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/inv/i);
    });
    it('404 → phone id', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 404 }),
      );
      const r = await whatsappMetaProvider.ping!(baseConfig, { apiKey: 't' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/encontrado|phone/i);
    });
    it('falha sem creds', async () => {
      const r = await whatsappMetaProvider.ping!(baseConfig, {});
      expect(r.ok).toBe(false);
    });
  });
});
