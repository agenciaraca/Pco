// Sender — orquestra envio: pega config ativa, valida, envia, loga.

import * as configStore from './config-store';
import * as logStore from './log-store';
import { getEmailProvider } from './providers/registry';
import type { EmailConfig, SendEmailInput, SendEmailResult } from './types';

export interface SendOptions {
  configId?: string; // se omitido usa config ativa
}

export async function sendEmail(
  input: SendEmailInput,
  opts: SendOptions = {},
): Promise<SendEmailResult> {
  const config = opts.configId
    ? await configStore.getConfig(opts.configId)
    : await configStore.getActiveConfig();

  if (!config) {
    throw new Error(
      'Nenhuma configuração de e-mail ativa. Configure em /admin/email primeiro.',
    );
  }
  if (!config.enabled) {
    throw new Error(`Configuração ${config.id} desativada.`);
  }
  return await sendWithConfig(config, input);
}

export async function sendWithConfig(
  config: EmailConfig,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const provider = getEmailProvider(config.provider);
  const creds = configStore.decryptCreds(config);
  const tos = Array.isArray(input.to) ? input.to : [input.to];
  const toLine = tos.map((t) => t.email).join(', ');

  try {
    const result = await provider.send(config, creds, input);
    await logStore.pushLog({
      configId: config.id,
      provider: config.provider,
      to: toLine,
      subject: input.subject,
      tag: input.tag,
      status: 'sent',
      externalId: result.externalId,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logStore.pushLog({
      configId: config.id,
      provider: config.provider,
      to: toLine,
      subject: input.subject,
      tag: input.tag,
      status: 'failed',
      error: msg,
    });
    throw err;
  }
}

export async function pingConfig(
  configId: string,
): Promise<{ ok: boolean; message: string }> {
  const config = await configStore.getConfig(configId);
  if (!config) return { ok: false, message: 'Configuração não encontrada.' };
  const provider = getEmailProvider(config.provider);
  if (!provider.ping) {
    return { ok: true, message: `Provider ${config.provider} não suporta ping.` };
  }
  const creds = configStore.decryptCreds(config);
  return await provider.ping(config, creds);
}

/**
 * Envia e-mail mas nunca lança — retorna ok/error. Útil em hooks (webhook,
 * password reset) onde falhar o e-mail não pode quebrar o fluxo principal.
 */
export async function sendSafe(
  input: SendEmailInput,
  opts: SendOptions = {},
): Promise<{ ok: boolean; error?: string; result?: SendEmailResult }> {
  try {
    const result = await sendEmail(input, opts);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
