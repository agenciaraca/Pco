// Twilio SMS provider.
// API: POST /2010-04-01/Accounts/{AccountSid}/Messages.json
// Auth: Basic AccountSid:AuthToken
// Body: x-www-form-urlencoded From, To, Body.

import type { MessagingProviderImpl } from './types';
import { MessagingProviderError } from './types';

const BASE = 'https://api.twilio.com';

function authHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

export const twilioMessagingProvider: MessagingProviderImpl = {
  async send(config, creds, input) {
    if (!creds.accountSid) {
      throw new MessagingProviderError('NO_SID', 'Twilio exige ACCOUNT_SID.');
    }
    if (!creds.apiKey) {
      throw new MessagingProviderError('NO_TOKEN', 'Twilio exige AUTH_TOKEN.');
    }
    if (!/^\+\d+$/.test(input.to)) {
      throw new MessagingProviderError(
        'INVALID_TO',
        'Destinatario deve estar em E.164 (+55...).',
      );
    }
    const form = new URLSearchParams();
    form.set('From', config.fromNumber);
    form.set('To', input.to);
    form.set('Body', input.body.slice(0, 1600));

    const url = `${BASE}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader(creds.accountSid, creds.apiKey),
        'Content-Type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new MessagingProviderError(
        'TWILIO_FAILED',
        `HTTP ${res.status}: ${j.slice(0, 300)}`,
      );
    }
    const j = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
    };
    return {
      providerId: 'twilio',
      externalId: j.sid,
      status:
        j.status === 'queued'
          ? 'queued'
          : j.status === 'failed'
            ? 'failed'
            : 'sent',
    };
  },

  async ping(_config, creds) {
    if (!creds.accountSid || !creds.apiKey) {
      return { ok: false, message: 'AccountSid/AuthToken ausente.' };
    }
    // GET account — endpoint mais leve
    const url = `${BASE}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`;
    const res = await fetch(url, {
      headers: { Authorization: authHeader(creds.accountSid, creds.apiKey) },
    });
    if (res.ok) return { ok: true, message: 'Twilio OK' };
    if (res.status === 401) return { ok: false, message: 'Credenciais invalidas.' };
    return { ok: false, message: `HTTP ${res.status}` };
  },
};
