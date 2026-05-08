// Tests do provider Brevo (mock fetch).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { brevoProvider } from '../server/notifications/providers/brevo';
import { EmailProviderError } from '../server/notifications/providers/types';
import type { EmailConfig } from '../server/notifications/types';

const baseConfig: EmailConfig = {
  id: 'cfg-brevo',
  provider: 'brevo',
  enabled: true,
  fromEmail: 'noreply@example.com',
  fromName: 'PCO',
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

describe('brevo provider', () => {
  describe('send', () => {
    it('exige API key', async () => {
      await expect(
        brevoProvider.send(baseConfig, {}, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toBeInstanceOf(EmailProviderError);
    });

    it('faz POST JSON com header api-key', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ messageId: 'msg-42' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const r = await brevoProvider.send(
        baseConfig,
        { apiKey: 'xkeysib-foo' },
        {
          to: { email: 'aluno@x.com', name: 'Aluno' },
          subject: 'Olá',
          html: '<p>oi</p>',
          text: 'oi',
          tag: 'tag1',
          replyTo: { email: 'reply@x.com' },
        },
      );
      expect(r.providerId).toBe('brevo');
      expect(r.accepted).toBe(1);
      expect(r.externalId).toBe('msg-42');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe('https://api.brevo.com/v3/smtp/email');
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['api-key']).toBe('xkeysib-foo');
      expect(headers['Content-Type']).toBe('application/json');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.subject).toBe('Olá');
      expect(body.htmlContent).toBe('<p>oi</p>');
      expect(body.textContent).toBe('oi');
      expect(body.to).toEqual([{ email: 'aluno@x.com', name: 'Aluno' }]);
      expect(body.tags).toEqual(['tag1']);
      expect(body.replyTo).toEqual({ email: 'reply@x.com' });
      expect(body.sender).toEqual({ email: 'noreply@example.com', name: 'PCO' });
    });

    it('aceita lista de destinatários e cc/bcc', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 201 }));
      await brevoProvider.send(
        baseConfig,
        { apiKey: 'k' },
        {
          to: [{ email: 'a@x.com' }, { email: 'b@x.com' }],
          cc: [{ email: 'c@x.com' }],
          bcc: [{ email: 'd@x.com' }],
          subject: 's',
          html: '<p>x</p>',
        },
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.to).toHaveLength(2);
      expect(body.cc).toEqual([{ email: 'c@x.com' }]);
      expect(body.bcc).toEqual([{ email: 'd@x.com' }]);
    });

    it('lança em HTTP não-2xx', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{"error":"bad"}', { status: 400 }),
      );
      await expect(
        brevoProvider.send(baseConfig, { apiKey: 'k' }, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toThrow(/400/);
    });
  });

  describe('ping', () => {
    it('retorna ok com 200', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );
      const r = await brevoProvider.ping!(baseConfig, { apiKey: 'k' });
      expect(r.ok).toBe(true);
    });
    it('detecta 401 como inválida', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 401 }),
      );
      const r = await brevoProvider.ping!(baseConfig, { apiKey: 'k' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/inv/i);
    });
    it('falha sem API key', async () => {
      const r = await brevoProvider.ping!(baseConfig, {});
      expect(r.ok).toBe(false);
    });
  });
});
