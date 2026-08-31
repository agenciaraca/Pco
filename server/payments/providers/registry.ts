// Registry de providers de pagamento.

import type { PaymentProvider } from '../types';
import type { PaymentProviderImpl } from './types';
import { mockProvider } from './mock';
import { stripeProvider } from './stripe';
import { asaasProvider } from './asaas';
import { pagarmeProvider } from './pagarme';
import { paypalProvider } from './paypal';
import { mercadopagoProvider } from './mercadopago';
import { sandraProvider } from './sandra';

const registry: Partial<Record<PaymentProvider, PaymentProviderImpl>> = {
  mock: mockProvider,
  stripe: stripeProvider,
  asaas: asaasProvider,
  pagarme: pagarmeProvider,
  paypal: paypalProvider,
  mercadopago: mercadopagoProvider,
  sandra: sandraProvider,
};

export function getPaymentProvider(name: PaymentProvider): PaymentProviderImpl | null {
  return registry[name] ?? null;
}

export function listImplementedProviders(): PaymentProvider[] {
  return Object.keys(registry) as PaymentProvider[];
}

export const ALL_PROVIDERS: Array<{ id: PaymentProvider; label: string; implemented: boolean }> = [
  { id: 'mock', label: 'Sandbox (mock)', implemented: true },
  { id: 'stripe', label: 'Stripe', implemented: true },
  { id: 'asaas', label: 'Asaas (PIX/Boleto/Cartão)', implemented: true },
  { id: 'pagarme', label: 'Pagar.me', implemented: true },
  { id: 'paypal', label: 'PayPal', implemented: true },
  { id: 'mercadopago', label: 'Mercado Pago', implemented: true },
  { id: 'sandra', label: 'Sandra (cobrança no gateway da escola)', implemented: true },
];
