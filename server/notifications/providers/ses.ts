// AWS SES via REST v2 (POST /v2/email/outbound-emails) com SigV4 manual.
// Sem AWS SDK — mantém zero deps pesadas.

import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';
import { signSigV4 } from './ses-sigv4';

const DEFAULT_REGION = 'us-east-1';

function fmtAddr(r: { email: string; name?: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

function endpointHost(region: string): string {
  return `email.${region}.amazonaws.com`;
}

interface SesPayload {
  FromEmailAddress: string;
  Destination: {
    ToAddresses: string[];
    CcAddresses?: string[];
    BccAddresses?: string[];
  };
  ReplyToAddresses?: string[];
  Content: {
    Simple: {
      Subject: { Data: string; Charset: string };
      Body: {
        Html: { Data: string; Charset: string };
        Text?: { Data: string; Charset: string };
      };
    };
  };
  EmailTags?: Array<{ Name: string; Value: string }>;
}

export const sesProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new EmailProviderError(
        'NO_KEY',
        'SES exige AWS_ACCESS_KEY_ID (apiKey).',
      );
    }
    if (!creds.sesSecretAccessKey) {
      throw new EmailProviderError(
        'NO_SECRET',
        'SES exige AWS_SECRET_ACCESS_KEY.',
      );
    }
    const region = config.sesRegion ?? DEFAULT_REGION;
    const tos = (Array.isArray(input.to) ? input.to : [input.to]).map(fmtAddr);

    const payload: SesPayload = {
      FromEmailAddress: fmtAddr({ email: config.fromEmail, name: config.fromName }),
      Destination: { ToAddresses: tos },
      Content: {
        Simple: {
          Subject: { Data: input.subject, Charset: 'UTF-8' },
          Body: { Html: { Data: input.html, Charset: 'UTF-8' } },
        },
      },
    };
    if (input.text) {
      payload.Content.Simple.Body.Text = { Data: input.text, Charset: 'UTF-8' };
    }
    if (input.cc?.length) payload.Destination.CcAddresses = input.cc.map(fmtAddr);
    if (input.bcc?.length) payload.Destination.BccAddresses = input.bcc.map(fmtAddr);
    const replyTo = input.replyTo
      ? [fmtAddr(input.replyTo)]
      : config.replyToEmail
        ? [config.replyToEmail]
        : undefined;
    if (replyTo) payload.ReplyToAddresses = replyTo;
    if (input.tag) {
      // SES exige Name/Value alfanumericos + . _ : / + = - @
      const safe = input.tag.replace(/[^A-Za-z0-9._:/+=@-]/g, '_').slice(0, 256);
      payload.EmailTags = [{ Name: 'tag', Value: safe }];
    }

    const body = JSON.stringify(payload);
    const path = '/v2/email/outbound-emails';
    const host = endpointHost(region);
    const signed = signSigV4({
      method: 'POST',
      host,
      path,
      body,
      region,
      service: 'ses',
      accessKeyId: creds.apiKey,
      secretAccessKey: creds.sesSecretAccessKey,
      extraHeaders: { 'content-type': 'application/json' },
    });

    const res = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: signed.headers,
      body,
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new EmailProviderError('SES_FAILED', `HTTP ${res.status}: ${j.slice(0, 300)}`);
    }
    const j = (await res.json().catch(() => ({}))) as { MessageId?: string };
    return {
      providerId: 'ses',
      externalId: j.MessageId,
      accepted: tos.length,
      rejected: 0,
    };
  },

  async ping(config, creds) {
    if (!creds.apiKey || !creds.sesSecretAccessKey) {
      return { ok: false, message: 'AWS access key/secret ausente.' };
    }
    const region = config.sesRegion ?? DEFAULT_REGION;
    const host = endpointHost(region);
    // GetAccount endpoint — confirma credenciais sem enviar e-mail.
    const path = '/v2/email/account';
    const signed = signSigV4({
      method: 'GET',
      host,
      path,
      body: '',
      region,
      service: 'ses',
      accessKeyId: creds.apiKey,
      secretAccessKey: creds.sesSecretAccessKey,
    });
    const res = await fetch(`https://${host}${path}`, {
      method: 'GET',
      headers: signed.headers,
    });
    if (res.ok) return { ok: true, message: `SES OK (${region})` };
    if (res.status === 403) return { ok: false, message: 'AWS credenciais inválidas.' };
    return { ok: false, message: `HTTP ${res.status}` };
  },
};
