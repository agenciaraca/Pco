// Tipos do módulo de webhooks de saída.

export type WebhookEventType =
  | 'order.paid'
  | 'order.canceled'
  | 'order.refunded'
  | 'enrollment.created'
  | 'user.created'
  | 'course.completed'
  | 'lesson.completed';

export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  'order.paid',
  'order.canceled',
  'order.refunded',
  'enrollment.created',
  'user.created',
  'course.completed',
  'lesson.completed',
];

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
  // Secret HMAC — sempre criptografado em repouso
  secretEncrypted?: string;
  // Headers extras opcionais (ex: X-Token), criptografado como JSON string
  headersEncrypted?: string;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastErrorMessage?: string;
}

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  nextAttemptAt?: string;
  lastResponseStatus?: number;
  lastResponseBody?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const RETRY_DELAYS_MS = [
  60_000, // 1 min
  5 * 60_000, // 5 min
  30 * 60_000, // 30 min
  2 * 60 * 60_000, // 2 h
];

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
