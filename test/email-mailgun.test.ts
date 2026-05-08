// Tests do provider Mailgun (mock fetch).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mailgunProvider } from '../server/notifications/providers/mailgun';
import { EmailProviderError } from '../server/notifications/providers/types';
import type { EmailConfig } from '../server/notifications/types';

const baseConfig: EmailConfig = {
  id: 'cfg-mg',
  provider: 'mailgun',
  enabled: true,
  fromEmail: 'noreply@example.com',
  fromName: 'PCO',
  mailgunDomain: 'mg.example.com',
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

describe('mailgun provider', () => {
  describe('send', () => {
    it('exige API key', async () => {
      await expect(
        mailgunProvider.send(baseConfig, {}, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toBeInstanceOf(EmailProviderError);
    });

    it('exige domain', async () => {
      const noDomain = { ...baseConfig, mailgunDomain: undefined };
      await expect(
        mailgunProvider.send(noDomain, { apiKey: 'k' }, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toThrow(/dom/i);
    });

    it('faz POST x-www-form-urlencoded para a região US por padrão', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '<abc@mg.example.com>' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const r = await mailgunProvider.send(
        baseConfig,
        { apiKey: 'key-123' },
        {
          to: [{ email: 'aluno@x.com', name: 'Aluno' }],
          subject: 'Bem-vindo',
          html: '<p>oi</p>',
          text: 'oi',
          tag: 'welcome',
        },
      );
      expect(r.providerId).toBe('mailgun');
      expect(r.accepted).toBe(1);
      expect(r.externalId).toBe('abc@mg.example.com');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(
        'https://api.mailgun.net/v3/mg.example.com/messages',
      );
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization.startsWith('Basic ')).toBe(true);
      expect(Buffer.from(headers.Authorization.slice(6), 'base64').toString()).toBe(
        'api:key-123',
      );
      const body = (init as RequestInit).body as string;
      expect(body).toContain('subject=Bem-vindo');
      expect(body).toContain('o%3Atag=welcome');
      expect(body).toContain('to=Aluno+%3Caluno%40x.com%3E');
    });

    it('usa região EU quando configurada', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{"id":"<x>"}', { status: 200 }));
      await mailgunProvider.send(
        { ...baseConfig, mailgunRegion: 'eu' },
        { apiKey: 'k' },
        { to: { email: 'a@b.c' }, subject: 's', html: '<p>x</p>' },
      );
      const [url] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('api.eu.mailgun.net');
    });

    it('lança em HTTP não-2xx', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('forbidden', { status: 403 }),
      );
      await expect(
        mailgunProvider.send(baseConfig, { apiKey: 'k' }, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toThrow(/403/);
    });
  });

  describe('ping', () => {
    it('retorna ok com 200', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );
      const r = await mailgunProvider.ping!(baseConfig, { apiKey: 'k' });
      expect(r.ok).toBe(true);
    });
    it('detecta 401 como API key inválida', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 401 }),
      );
      const r = await mailgunProvider.ping!(baseConfig, { apiKey: 'k' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/inv/i);
    });
    it('detecta 404 como domain not found', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 404 }),
      );
      const r = await mailgunProvider.ping!(baseConfig, { apiKey: 'k' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/encontrado/i);
    });
    it('falha sem API key', async () => {
      const r = await mailgunProvider.ping!(baseConfig, {});
      expect(r.ok).toBe(false);
    });
    it('falha sem domain', async () => {
      const r = await mailgunProvider.ping!(
        { ...baseConfig, mailgunDomain: undefined },
        { apiKey: 'k' },
      );
      expect(r.ok).toBe(false);
    });
  });
});
