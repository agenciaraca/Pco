// Resend.com — REST simples: POST https://api.resend.com/emails

import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';

const BASE = 'https://api.resend.com';

function fmtAddr(r: { email: string; name?: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

export const resendProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new EmailProviderError('NO_KEY', 'Resend exige API key.');
    }
    const tos = (Array.isArray(input.to) ? input.to : [input.to]).map(fmtAddr);
    const body = {
      from: fmtAddr({ email: config.fromEmail, name: config.fromName }),
      to: tos,
      subject: input.subject,
      html: input.html,
      text: input.text,
      cc: input.cc?.map(fmtAddr),
      bcc: input.bcc?.map(fmtAddr),
      reply_to: input.replyTo ? fmtAddr(input.replyTo) : config.replyToEmail,
      tags: input.tag
        ? [{ name: 'tag', value: input.tag.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) }]
        : undefined,
    };
    const res = await fetch(`${BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new EmailProviderError('RESEND_FAILED', `HTTP ${res.status}: ${j.slice(0, 200)}`);
    }
    const j = (await res.json()) as { id?: string };
    return {
      providerId: 'resend',
      externalId: j.id,
      accepted: tos.length,
      rejected: 0,
    };
  },

  async ping(_config, creds) {
    if (!creds.apiKey) return { ok: false, message: 'API key ausente.' };
    const res = await fetch(`${BASE}/api-keys`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    if (res.status === 200 || res.status === 401) {
      return res.ok
        ? { ok: true, message: 'Resend OK' }
        : { ok: false, message: 'API key inválida.' };
    }
    return { ok: false, message: `HTTP ${res.status}` };
  },
};
