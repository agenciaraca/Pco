// SendGrid — REST v3 /mail/send

import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';

const BASE = 'https://api.sendgrid.com';

export const sendgridProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new EmailProviderError('NO_KEY', 'SendGrid exige API key.');
    }
    const tos = (Array.isArray(input.to) ? input.to : [input.to]).map((t) => ({
      email: t.email,
      name: t.name,
    }));
    const body = {
      personalizations: [
        {
          to: tos,
          cc: input.cc?.map((c) => ({ email: c.email, name: c.name })),
          bcc: input.bcc?.map((b) => ({ email: b.email, name: b.name })),
          subject: input.subject,
        },
      ],
      from: { email: config.fromEmail, name: config.fromName },
      reply_to: input.replyTo
        ? { email: input.replyTo.email, name: input.replyTo.name }
        : config.replyToEmail
          ? { email: config.replyToEmail }
          : undefined,
      content: [
        ...(input.text ? [{ type: 'text/plain', value: input.text }] : []),
        { type: 'text/html', value: input.html },
      ],
      categories: input.tag ? [input.tag.slice(0, 255)] : undefined,
    };
    const res = await fetch(`${BASE}/v3/mail/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new EmailProviderError(
        'SENDGRID_FAILED',
        `HTTP ${res.status}: ${j.slice(0, 200)}`,
      );
    }
    return {
      providerId: 'sendgrid',
      externalId: res.headers.get('X-Message-Id') ?? undefined,
      accepted: tos.length,
      rejected: 0,
    };
  },

  async ping(_config, creds) {
    if (!creds.apiKey) return { ok: false, message: 'API key ausente.' };
    const res = await fetch(`${BASE}/v3/scopes`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    return res.ok
      ? { ok: true, message: 'SendGrid OK' }
      : { ok: false, message: `HTTP ${res.status}` };
  },
};
