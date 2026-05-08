// Brevo (ex-SendinBlue) — REST v3 /smtp/email.
// Auth via header `api-key: <key>`.

import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';

const BASE = 'https://api.brevo.com';

function fmtAddr(r: { email: string; name?: string }): { email: string; name?: string } {
  return r.name ? { email: r.email, name: r.name } : { email: r.email };
}

export const brevoProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new EmailProviderError('NO_KEY', 'Brevo exige API key.');
    }
    const toArr = (Array.isArray(input.to) ? input.to : [input.to]).map(fmtAddr);
    const body: Record<string, unknown> = {
      sender: fmtAddr({ email: config.fromEmail, name: config.fromName }),
      to: toArr,
      subject: input.subject,
      htmlContent: input.html,
    };
    if (input.text) body.textContent = input.text;
    if (input.cc?.length) body.cc = input.cc.map(fmtAddr);
    if (input.bcc?.length) body.bcc = input.bcc.map(fmtAddr);
    if (input.replyTo) body.replyTo = fmtAddr(input.replyTo);
    else if (config.replyToEmail) body.replyTo = { email: config.replyToEmail };
    if (input.tag) body.tags = [input.tag.slice(0, 200)];

    const res = await fetch(`${BASE}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': creds.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new EmailProviderError('BREVO_FAILED', `HTTP ${res.status}: ${j.slice(0, 200)}`);
    }
    const j = (await res.json().catch(() => ({}))) as { messageId?: string };
    return {
      providerId: 'brevo',
      externalId: j.messageId,
      accepted: toArr.length,
      rejected: 0,
    };
  },

  async ping(_config, creds) {
    if (!creds.apiKey) return { ok: false, message: 'API key ausente.' };
    const res = await fetch(`${BASE}/v3/account`, {
      headers: { 'api-key': creds.apiKey, accept: 'application/json' },
    });
    if (res.ok) return { ok: true, message: 'Brevo OK' };
    if (res.status === 401) return { ok: false, message: 'API key inválida.' };
    return { ok: false, message: `HTTP ${res.status}` };
  },
};
