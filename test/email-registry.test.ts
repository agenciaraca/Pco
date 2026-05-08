// Tests do registry de providers de e-mail — garante que os 8 providers
// estao registrados e respondem a getEmailProvider.

import { describe, it, expect } from 'vitest';
import {
  ALL_EMAIL_PROVIDERS,
  getEmailProvider,
} from '../server/notifications/providers/registry';

describe('email providers registry', () => {
  it('lista todos os providers conhecidos', () => {
    expect(ALL_EMAIL_PROVIDERS).toEqual([
      'mock',
      'resend',
      'sendgrid',
      'postmark',
      'mailgun',
      'brevo',
      'ses',
      'smtp',
    ]);
  });

  it.each([
    'mock',
    'resend',
    'sendgrid',
    'postmark',
    'mailgun',
    'brevo',
    'ses',
    'smtp',
  ] as const)(
    '%s tem implementação send + ping',
    (id) => {
      const p = getEmailProvider(id);
      expect(typeof p.send).toBe('function');
      expect(typeof p.ping).toBe('function');
    },
  );

  it('id desconhecido lança UNKNOWN_PROVIDER', () => {
    expect(() =>
      getEmailProvider('foo' as unknown as Parameters<typeof getEmailProvider>[0]),
    ).toThrow(/UNKNOWN_PROVIDER|desconhecido/);
  });
});
