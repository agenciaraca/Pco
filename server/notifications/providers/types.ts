// Abstração de provider de e-mail. Cada provider implementa send() e ping().

import type { EmailConfig, SendEmailInput, SendEmailResult } from '../types';

export interface DecryptedEmailCreds {
  apiKey?: string;
  smtpPassword?: string;
}

export class EmailProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface EmailProviderImpl {
  send(
    config: EmailConfig,
    creds: DecryptedEmailCreds,
    input: SendEmailInput,
  ): Promise<SendEmailResult>;
  ping?(
    config: EmailConfig,
    creds: DecryptedEmailCreds,
  ): Promise<{ ok: boolean; message: string }>;
}
