// Tipos do módulo de e-mail transacional.

export type EmailProviderId = 'mock' | 'resend' | 'sendgrid' | 'postmark' | 'smtp';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailInput {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: EmailRecipient;
  // Tag/categoria pra rastrear nos logs
  tag?: string;
  metadata?: Record<string, string>;
}

export interface SendEmailResult {
  providerId: EmailProviderId;
  externalId?: string; // id retornado pelo provider
  accepted: number;
  rejected: number;
}

export interface EmailConfig {
  id: string;
  provider: EmailProviderId;
  enabled: boolean;
  // Identidade do remetente
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  // Credenciais — sempre criptografadas
  apiKeyEncrypted?: string; // Resend, SendGrid, Postmark
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPasswordEncrypted?: string;
  smtpSecure?: boolean;
  // Métricas
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type EmailLogStatus = 'queued' | 'sent' | 'failed';

export interface EmailLog {
  id: string;
  configId: string;
  provider: EmailProviderId;
  to: string;
  subject: string;
  tag?: string;
  status: EmailLogStatus;
  externalId?: string;
  error?: string;
  ts: string;
}
