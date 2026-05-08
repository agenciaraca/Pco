// Tipos do modulo de mensageria SMS / WhatsApp.
// Separado de notifications/email porque o canal e diferente (telefone
// como destinatario, sem subject, body curto).

export type MessagingProviderId = 'mock' | 'twilio' | 'whatsapp-meta';

export interface MessagingConfig {
  id: string;
  provider: MessagingProviderId;
  enabled: boolean;
  /** Numero/sender ID identificacao no provider (ex: +55119..., AVA-PCO). */
  fromNumber: string;
  // Credenciais — sempre criptografadas
  apiKeyEncrypted?: string; // Twilio AUTH_TOKEN, Meta access token
  accountSidEncrypted?: string; // Twilio ACCOUNT_SID
  // Meta WhatsApp Cloud
  whatsappPhoneNumberId?: string;
  // Métricas
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendSmsInput {
  /** E.164 obrigatorio (+5511...). */
  to: string;
  body: string;
  /** Para WhatsApp Meta: ID do template aprovado. */
  whatsappTemplate?: string;
  /** Tag livre pra logs. */
  tag?: string;
}

export interface SendSmsResult {
  providerId: MessagingProviderId;
  externalId?: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}
