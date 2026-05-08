// Abstracao de provider de mensageria.

import type { MessagingConfig, SendSmsInput, SendSmsResult } from '../types';

export interface DecryptedMessagingCreds {
  apiKey?: string;
  accountSid?: string;
}

export class MessagingProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface MessagingProviderImpl {
  send(
    config: MessagingConfig,
    creds: DecryptedMessagingCreds,
    input: SendSmsInput,
  ): Promise<SendSmsResult>;
  ping?(
    config: MessagingConfig,
    creds: DecryptedMessagingCreds,
  ): Promise<{ ok: boolean; message: string }>;
}
