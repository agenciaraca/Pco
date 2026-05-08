// WhatsApp Cloud API (Meta).
// Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
// Auth: Bearer {ACCESS_TOKEN} (creds.apiKey).
// PHONE_NUMBER_ID vai em config.whatsappPhoneNumberId.
// To: numero E.164 sem '+' (ex.: "5511999999999").

import type { MessagingProviderImpl } from './types';
import { MessagingProviderError } from './types';

const BASE = 'https://graph.facebook.com';
const VERSION = process.env.WHATSAPP_API_VERSION ?? 'v18.0';

interface TextMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

interface TemplateMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
  };
}

function normalizeTo(to: string): string {
  // Aceita "+5511..." e converte pra "5511..." (formato Meta).
  if (to.startsWith('+')) return to.slice(1);
  return to;
}

export const whatsappMetaProvider: MessagingProviderImpl = {
  async send(config, creds, input) {
    if (!creds.apiKey) {
      throw new MessagingProviderError(
        'NO_TOKEN',
        'WhatsApp Cloud exige access token (apiKey).',
      );
    }
    if (!config.whatsappPhoneNumberId) {
      throw new MessagingProviderError(
        'NO_PHONE_ID',
        'WhatsApp Cloud exige whatsappPhoneNumberId.',
      );
    }
    const to = normalizeTo(input.to);
    if (!/^\d+$/.test(to)) {
      throw new MessagingProviderError(
        'INVALID_TO',
        'Destinatario deve ser numero E.164 (sem espacos/hifens).',
      );
    }

    let payload: TextMessage | TemplateMessage;
    if (input.whatsappTemplate) {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: input.whatsappTemplate,
          language: { code: 'pt_BR' },
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: input.body.slice(0, 4096), preview_url: false },
      };
    }

    const url = `${BASE}/${VERSION}/${encodeURIComponent(config.whatsappPhoneNumberId)}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.text().catch(() => '');
      throw new MessagingProviderError(
        'WHATSAPP_FAILED',
        `HTTP ${res.status}: ${j.slice(0, 300)}`,
      );
    }
    const j = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    return {
      providerId: 'whatsapp-meta',
      externalId: j.messages?.[0]?.id,
      status: 'sent',
    };
  },

  async ping(config, creds) {
    if (!creds.apiKey || !config.whatsappPhoneNumberId) {
      return { ok: false, message: 'Access token / phone number id ausente.' };
    }
    // GET /{phone_number_id} — confirma que credencial enxerga o numero.
    const url = `${BASE}/${VERSION}/${encodeURIComponent(config.whatsappPhoneNumberId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    if (res.ok) return { ok: true, message: 'WhatsApp Cloud OK' };
    if (res.status === 401) {
      return { ok: false, message: 'Access token invalido.' };
    }
    if (res.status === 404) {
      return { ok: false, message: 'Phone number id nao encontrado.' };
    }
    return { ok: false, message: `HTTP ${res.status}` };
  },
};
