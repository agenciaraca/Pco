// Tests do registry de providers de e-mail — garante que os 6 providers
// estão registrados e que SMTP retorna NOT_IMPLEMENTED de propósito.

import { describe, it, expect } from 'vitest';
import {
  ALL_EMAIL_PROVIDERS,
  getEmailProvider,
} from '../server/notifications/providers/registry';
import { EmailProviderError } from '../server/notifications/providers/types';

describe('email providers registry', () => {
  it('lista todos os providers conhecidos', () => {
    expect(ALL_EMAIL_PROVIDERS).toEqual([
      'mock',
      'resend',
      'sendgrid',
      'postmark',
      'mailgun',
      'brevo',
      'smtp',
    ]);
  });

  it.each(['mock', 'resend', 'sendgrid', 'postmark', 'mailgun', 'brevo'] as const)(
    '%s tem implementação send + ping',
    (id) => {
      const p = getEmailProvider(id);
      expect(typeof p.send).toBe('function');
      expect(typeof p.ping).toBe('function');
    },
  );

  it('smtp lança NOT_IMPLEMENTED', () => {
    expect(() => getEmailProvider('smtp')).toThrow(EmailProviderError);
    try {
      getEmailProvider('smtp');
    } catch (e) {
      expect((e as EmailProviderError).code).toBe('NOT_IMPLEMENTED');
    }
  });

  it('id desconhecido lança UNKNOWN_PROVIDER', () => {
    expect(() =>
      getEmailProvider('foo' as unknown as Parameters<typeof getEmailProvider>[0]),
    ).toThrow(/UNKNOWN_PROVIDER|desconhecido/);
  });
});
