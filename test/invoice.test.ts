import { describe, it, expect } from 'vitest';
import { renderInvoiceHtml } from '../server/payments/invoice';
import type { Order } from '../server/payments/types';

const baseOrder: Order = {
  id: 'ord-test-123',
  userId: 'u1',
  userEmail: 'cliente@test.com',
  productId: 'prod-1',
  productSnapshot: {
    name: 'Curso de Psicanálise',
    priceCents: 50000,
    currency: 'BRL',
    kind: 'course',
    refId: 'c-1',
  },
  gatewayId: 'gw-1',
  gatewayProvider: 'mock',
  externalId: 'ext-payment-abc',
  status: 'paid',
  amountCents: 50000,
  currency: 'BRL',
  events: [],
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:30:00Z',
  paidAt: '2025-01-15T10:30:00Z',
};

describe('renderInvoiceHtml', () => {
  it('inclui número do recibo, valor e data', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João Silva', email: 'cliente@test.com' },
    });
    expect(html).toContain('ord-test-123');
    // toLocaleString pode usar nbsp ou espaço normal
    expect(html).toMatch(/R\$\s?500,00|R\$&nbsp;500,00/);
    // Data pode variar por timezone — verifica apenas que tem alguma data
    expect(html).toMatch(/15\/01\/2025|14\/01\/2025/);
  });

  it('mostra status PAGO quando paid', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('PAGO');
  });

  it('mostra status REFUNDED', () => {
    const html = renderInvoiceHtml({
      order: { ...baseOrder, status: 'refunded' },
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('REFUNDED');
  });

  it('inclui dados do pagador', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: {
        name: 'Maria Souza',
        email: 'maria@test.com',
        document: '123.456.789-00',
      },
    });
    expect(html).toContain('Maria Souza');
    expect(html).toContain('maria@test.com');
    expect(html).toContain('123.456.789-00');
  });

  it('omite documento quando não fornecido', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).not.toContain('CPF/CNPJ');
  });

  it('escapa HTML para prevenir XSS', () => {
    const html = renderInvoiceHtml({
      order: {
        ...baseOrder,
        productSnapshot: {
          ...baseOrder.productSnapshot,
          name: '<script>alert(1)</script>',
        },
      },
      user: { name: '<img src=x>', email: 'a@b.com' },
    });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
  });

  it('inclui externalId do gateway', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('ext-payment-abc');
  });

  it('botão de imprimir presente', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('window.print()');
    expect(html).toContain('Imprimir / Salvar PDF');
  });

  it('CSS @media print esconde actions', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('@media print');
    expect(html).toContain('.actions { display: none; }');
  });

  it('aceita currency USD', () => {
    const html = renderInvoiceHtml({
      order: { ...baseOrder, currency: 'USD' },
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toMatch(/US\$|USD|\$/);
  });

  it('mostra orgName e orgAddress customizados', () => {
    const html = renderInvoiceHtml({
      order: baseOrder,
      user: { name: 'João', email: 'a@b.com' },
      orgName: 'Minha Escola',
      orgAddress: 'Rua X, 123',
    });
    expect(html).toContain('Minha Escola');
    expect(html).toContain('Rua X, 123');
  });

  it('omite paidDate quando não há paidAt', () => {
    const html = renderInvoiceHtml({
      order: { ...baseOrder, paidAt: null, status: 'pending' },
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('PENDING');
    expect(html).not.toContain('Confirmado em:');
  });

  it('mostra status REFUNDED em vermelho/cyan', () => {
    const html = renderInvoiceHtml({
      order: { ...baseOrder, status: 'refunded' },
      user: { name: 'João', email: 'a@b.com' },
    });
    expect(html).toContain('REFUNDED');
    expect(html).toContain('badge refunded');
  });
});
