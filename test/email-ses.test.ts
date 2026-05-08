// Tests do provider AWS SES (mock fetch).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sesProvider } from '../server/notifications/providers/ses';
import { EmailProviderError } from '../server/notifications/providers/types';
import type { EmailConfig } from '../server/notifications/types';

const baseConfig: EmailConfig = {
  id: 'cfg-ses',
  provider: 'ses',
  enabled: true,
  fromEmail: 'noreply@example.com',
  fromName: 'PCO',
  sesRegion: 'us-east-1',
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

describe('SES provider', () => {
  describe('send', () => {
    it('exige access key (apiKey)', async () => {
      await expect(
        sesProvider.send(baseConfig, { sesSecretAccessKey: 's' }, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toBeInstanceOf(EmailProviderError);
    });

    it('exige secret access key', async () => {
      await expect(
        sesProvider.send(baseConfig, { apiKey: 'AKIA' }, {
          to: { email: 'a@b.c' },
          subject: 's',
          html: '<p>x</p>',
        }),
      ).rejects.toThrow(/secret/i);
    });

    it('faz POST para email.{region}.amazonaws.com com SigV4', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ MessageId: 'msg-abc' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const r = await sesProvider.send(
        baseConfig,
        { apiKey: 'AKIATEST', sesSecretAccessKey: 'secret' },
        {
          to: { email: 'aluno@x.com', name: 'Aluno' },
          subject: 'Olá',
          html: '<p>oi</p>',
          text: 'oi',
          tag: 'welcome!',
        },
      );
      expect(r.providerId).toBe('ses');
      expect(r.externalId).toBe('msg-abc');
      expect(r.accepted).toBe(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(
        'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails',
      );
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
      expect(headers['x-amz-date']).toBeTruthy();
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.FromEmailAddress).toBe('PCO <noreply@example.com>');
      expect(body.Destination.ToAddresses).toEqual(['Aluno <aluno@x.com>']);
      expect(body.Content.Simple.Subject.Data).toBe('Olá');
      expect(body.Content.Simple.Body.Html.Data).toBe('<p>oi</p>');
      expect(body.Content.Simple.Body.Text.Data).toBe('oi');
      // Tag sanitized — '!' substituído por '_'.
      expect(body.EmailTags[0].Value).toBe('welcome_');
    });

    it('usa região default us-east-1 quando não configurada', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      await sesProvider.send(
        { ...baseConfig, sesRegion: undefined },
        { apiKey: 'k', sesSecretAccessKey: 's' },
        { to: { email: 'a@b.c' }, subject: 's', html: '<p>x</p>' },
      );
      expect(String(fetchMock.mock.calls[0][0])).toContain(
        'email.us-east-1.amazonaws.com',
      );
    });

    it('usa região customizada (eu-west-1)', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      await sesProvider.send(
        { ...baseConfig, sesRegion: 'eu-west-1' },
        { apiKey: 'k', sesSecretAccessKey: 's' },
        { to: { email: 'a@b.c' }, subject: 's', html: '<p>x</p>' },
      );
      expect(String(fetchMock.mock.calls[0][0])).toContain(
        'email.eu-west-1.amazonaws.com',
      );
    });

    it('lança em HTTP não-2xx', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('AccessDenied', { status: 403 }),
      );
      await expect(
        sesProvider.send(
          baseConfig,
          { apiKey: 'k', sesSecretAccessKey: 's' },
          { to: { email: 'a@b.c' }, subject: 's', html: '<p>x</p>' },
        ),
      ).rejects.toThrow(/403/);
    });

    it('inclui cc/bcc/replyTo no payload', async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
      await sesProvider.send(
        baseConfig,
        { apiKey: 'k', sesSecretAccessKey: 's' },
        {
          to: { email: 'a@b.c' },
          cc: [{ email: 'cc@x.com' }],
          bcc: [{ email: 'bcc@x.com' }],
          replyTo: { email: 'reply@x.com' },
          subject: 's',
          html: '<p>x</p>',
        },
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.Destination.CcAddresses).toEqual(['cc@x.com']);
      expect(body.Destination.BccAddresses).toEqual(['bcc@x.com']);
      expect(body.ReplyToAddresses).toEqual(['reply@x.com']);
    });
  });

  describe('ping', () => {
    it('200 → ok', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );
      const r = await sesProvider.ping!(baseConfig, {
        apiKey: 'k',
        sesSecretAccessKey: 's',
      });
      expect(r.ok).toBe(true);
      expect(r.message).toContain('us-east-1');
    });
    it('403 → credenciais inválidas', async () => {
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{}', { status: 403 }),
      );
      const r = await sesProvider.ping!(baseConfig, {
        apiKey: 'k',
        sesSecretAccessKey: 's',
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/inv/i);
    });
    it('falha sem creds', async () => {
      const r = await sesProvider.ping!(baseConfig, {});
      expect(r.ok).toBe(false);
    });
  });
});
