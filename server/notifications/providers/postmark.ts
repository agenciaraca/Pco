// Postmark — REST POST https://api.postmarkapp.com/email com header X-Postmark-Server-Token

import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';

const BASE = 'https://api.postmarkapp.com';

function fmtAddr(r: { email: string; name?: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

export const postmarkProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new EmailProviderError('NO_KEY', 'Postmark exige Server Token.');
    }
    const tos = (Array.isArray(input.to) ? input.to : [input.to]).map(fmtAddr).join(', ');
    const body = {
      From: fmtAddr({ email: config.fromEmail, name: config.fromName }),
      To: tos,
      Cc: input.cc?.map(fmtAddr).join(', '),
      Bcc: input.bcc?.map(fmtAddr).join(', '),
      ReplyTo: input.replyTo ? fmtAddr(input.replyTo) : config.replyToEmail,
      Subject: input.subject,
      HtmlBody: input.html,
      TextBody: input.text,
      Tag: input.tag,
      MessageStream: 'outbound',
    };
    const res = await fetch(`${BASE}/email`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': creds.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new EmailProviderError(
        'POSTMARK_FAILED',
        `HTTP ${res.status}: ${j.slice(0, 200)}`,
      );
    }
    const j = (await res.json()) as { MessageID?: string; ErrorCode?: number };
    if (j.ErrorCode && j.ErrorCode !== 0) {
      throw new EmailProviderError('POSTMARK_FAILED', JSON.stringify(j));
    }
    return {
      providerId: 'postmark',
      externalId: j.MessageID,
      accepted: 1,
      rejected: 0,
    };
  },

  async ping(_config, creds) {
    if (!creds.apiKey) return { ok: false, message: 'Server Token ausente.' };
    const res = await fetch(`${BASE}/server`, {
      headers: {
        Accept: 'application/json',
        'X-Postmark-Server-Token': creds.apiKey,
      },
    });
    return res.ok
      ? { ok: true, message: 'Postmark OK' }
      : { ok: false, message: `HTTP ${res.status}` };
  },
};
