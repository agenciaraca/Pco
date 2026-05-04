// Registry de providers de pagamento.

import type { PaymentProvider } from '../types';
import type { PaymentProviderImpl } from './types';
import { mockProvider } from './mock';

// Por enquanto só mock. Sprint 4 adiciona Stripe/Asaas/Pagar.me/PayPal/MP.
const registry: Partial<Record<PaymentProvider, PaymentProviderImpl>> = {
  mock: mockProvider,
};

export function getPaymentProvider(name: PaymentProvider): PaymentProviderImpl | null {
  return registry[name] ?? null;
}

export function listImplementedProviders(): PaymentProvider[] {
  return Object.keys(registry) as PaymentProvider[];
}

export const ALL_PROVIDERS: Array<{ id: PaymentProvider; label: string; implemented: boolean }> = [
  { id: 'mock', label: 'Sandbox (mock)', implemented: true },
  { id: 'stripe', label: 'Stripe', implemented: false },
  { id: 'asaas', label: 'Asaas', implemented: false },
  { id: 'pagarme', label: 'Pagar.me', implemented: false },
  { id: 'paypal', label: 'PayPal', implemented: false },
  { id: 'mercadopago', label: 'Mercado Pago (PIX)', implemented: false },
];
