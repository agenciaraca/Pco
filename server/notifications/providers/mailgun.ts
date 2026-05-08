// Mailgun — REST v3 /messages.
// Auth: Basic com user "api" e password = API key.
// Domínio do remetente vem de config.mailgunDomain (ex.: "mg.example.com").
// Região: 'us' (api.mailgun.net) ou 'eu' (api.eu.mailgun.net).

import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';

function regionBase(region?: 'us' | 'eu'): string {
  return region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
}

function fmtAddr(r: { email: string; name?: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`;
}

export const mailgunProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new EmailProviderError('NO_KEY', 'Mailgun exige API key.');
    }
    if (!config.mailgunDomain) {
      throw new EmailProviderError(
        'NO_DOMAIN',
        'Mailgun exige domínio (config.mailgunDomain).',
      );
    }
    const tos = (Array.isArray(input.to) ? input.to : [input.to]).map(fmtAddr);
    const form = new URLSearchParams();
    form.set('from', fmtAddr({ email: config.fromEmail, name: config.fromName }));
    for (const t of tos) form.append('to', t);
    if (input.cc?.length) for (const c of input.cc) form.append('cc', fmtAddr(c));
    if (input.bcc?.length) for (const b of input.bcc) form.append('bcc', fmtAddr(b));
    if (input.replyTo) form.set('h:Reply-To', fmtAddr(input.replyTo));
    else if (config.replyToEmail) form.set('h:Reply-To', config.replyToEmail);
    form.set('subject', input.subject);
    form.set('html', input.html);
    if (input.text) form.set('text', input.text);
    if (input.tag) form.append('o:tag', input.tag.slice(0, 128));

    const url = `${regionBase(config.mailgunRegion)}/v3/${encodeURIComponent(
      config.mailgunDomain,
    )}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader(creds.apiKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new EmailProviderError(
        'MAILGUN_FAILED',
        `HTTP ${res.status}: ${j.slice(0, 200)}`,
      );
    }
    const j = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      providerId: 'mailgun',
      externalId: j.id?.replace(/^<|>$/g, ''),
      accepted: tos.length,
      rejected: 0,
    };
  },

  async ping(config, creds) {
    if (!creds.apiKey) return { ok: false, message: 'API key ausente.' };
    if (!config.mailgunDomain) {
      return { ok: false, message: 'Domínio Mailgun ausente.' };
    }
    const url = `${regionBase(config.mailgunRegion)}/v3/domains/${encodeURIComponent(
      config.mailgunDomain,
    )}`;
    const res = await fetch(url, { headers: { Authorization: authHeader(creds.apiKey) } });
    if (res.ok) return { ok: true, message: 'Mailgun OK' };
    if (res.status === 401) return { ok: false, message: 'API key inválida.' };
    if (res.status === 404) return { ok: false, message: 'Domínio não encontrado.' };
    return { ok: false, message: `HTTP ${res.status}` };
  },
};
