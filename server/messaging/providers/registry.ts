// Registry dos providers de mensageria.

import type { MessagingProviderId } from '../types';
import type { MessagingProviderImpl } from './types';
import { MessagingProviderError } from './types';
import { mockMessagingProvider } from './mock';
import { twilioMessagingProvider } from './twilio';

export const ALL_MESSAGING_PROVIDERS: MessagingProviderId[] = [
  'mock',
  'twilio',
  'whatsapp-meta',
];

export function getMessagingProvider(id: MessagingProviderId): MessagingProviderImpl {
  switch (id) {
    case 'mock':
      return mockMessagingProvider;
    case 'twilio':
      return twilioMessagingProvider;
    case 'whatsapp-meta':
      throw new MessagingProviderError(
        'NOT_IMPLEMENTED',
        'WhatsApp Meta Cloud API ainda nao suportado. Use Twilio (com whatsapp:+...) ou mock.',
      );
    default:
      throw new MessagingProviderError(
        'UNKNOWN_PROVIDER',
        `Provider desconhecido: ${id}`,
      );
  }
}
