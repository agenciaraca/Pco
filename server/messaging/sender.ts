// Wrapper sendSafe pra mensageria — captura erros, registra log,
// nunca propaga exception pro caller. Padrao similar a notifications/sender
// pra email.

import { getMessagingProvider } from './providers/registry';
import type { DecryptedMessagingCreds } from './providers/types';
import { MessagingProviderError } from './providers/types';
import { recordMessage } from './log-store';
import type {
  MessagingConfig,
  SendSmsInput,
  SendSmsResult,
} from './types';

export interface SendSafeResult {
  ok: boolean;
  result?: SendSmsResult;
  error?: { code: string; message: string };
}

/**
 * Envia mensagem via provider configurado, registra log estruturado
 * em data/messaging-log.json e nunca rejeita.
 */
export async function sendSafe(
  config: MessagingConfig,
  creds: DecryptedMessagingCreds,
  input: SendSmsInput,
): Promise<SendSafeResult> {
  if (!config.enabled) {
    await recordMessage({
      provider: config.provider,
      to: input.to,
      body: input.body.slice(0, 200),
      tag: input.tag,
      status: 'failed',
      error: 'Config disabled',
    });
    return { ok: false, error: { code: 'DISABLED', message: 'Config desativada.' } };
  }

  let provider;
  try {
    provider = getMessagingProvider(config.provider);
  } catch (e) {
    const code = e instanceof MessagingProviderError ? e.code : 'UNKNOWN';
    const message = e instanceof Error ? e.message : String(e);
    await recordMessage({
      provider: config.provider,
      to: input.to,
      body: input.body.slice(0, 200),
      tag: input.tag,
      status: 'failed',
      error: `${code}: ${message}`,
    });
    return { ok: false, error: { code, message } };
  }

  try {
    const result = await provider.send(config, creds, input);
    await recordMessage({
      provider: result.providerId,
      to: input.to,
      body: input.body.slice(0, 200),
      tag: input.tag,
      status: result.status,
      externalId: result.externalId,
      error: result.error,
    });
    return { ok: result.status !== 'failed', result };
  } catch (e) {
    const code = e instanceof MessagingProviderError ? e.code : 'UNKNOWN';
    const message = e instanceof Error ? e.message : String(e);
    await recordMessage({
      provider: config.provider,
      to: input.to,
      body: input.body.slice(0, 200),
      tag: input.tag,
      status: 'failed',
      error: `${code}: ${message}`,
    });
    return { ok: false, error: { code, message } };
  }
}
