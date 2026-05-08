// Registry de providers de e-mail.

import type { EmailProviderId } from '../types';
import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';
import { mockProvider } from './mock';
import { resendProvider } from './resend';
import { sendgridProvider } from './sendgrid';
import { postmarkProvider } from './postmark';
import { mailgunProvider } from './mailgun';
import { brevoProvider } from './brevo';

export const ALL_EMAIL_PROVIDERS: EmailProviderId[] = [
  'mock',
  'resend',
  'sendgrid',
  'postmark',
  'mailgun',
  'brevo',
  'smtp',
];

export function getEmailProvider(id: EmailProviderId): EmailProviderImpl {
  switch (id) {
    case 'mock':
      return mockProvider;
    case 'resend':
      return resendProvider;
    case 'sendgrid':
      return sendgridProvider;
    case 'postmark':
      return postmarkProvider;
    case 'mailgun':
      return mailgunProvider;
    case 'brevo':
      return brevoProvider;
    case 'smtp':
      throw new EmailProviderError(
        'NOT_IMPLEMENTED',
        'SMTP ainda não suportado. Use Resend, SendGrid, Postmark, Mailgun ou Brevo.',
      );
    default:
      throw new EmailProviderError('UNKNOWN_PROVIDER', `Provider desconhecido: ${id}`);
  }
}
