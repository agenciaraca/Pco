// Método de pagamento — pix, boleto ou cartão.
//
// ## Por que isto precisou existir
//
// Até 5/set/2026 o método **não era um dado nosso**. Cada provider inventava o
// seu, e os padrões discordavam entre si:
//
// - o Asaas lia `metadata.billingType` e, na falta, cobrava **PIX**;
// - o Pagar.me montava `accepted_payment_methods` com os três e deixava o
//   comprador escolher dentro do gateway;
// - o Stripe fixava `payment_method_types[0] = 'card'`;
// - a Sandra usava `options.metodo`, configurado por gateway.
//
// Enquanto o método vive dentro do provider, não há onde pendurar roteamento:
// para mandar boleto a um gateway e cartão a outro é preciso saber o método
// **antes** de escolher o gateway. Daí este arquivo, e daí o campo `metodo`
// atravessar o checkout, o `CreatePaymentInput` e cada provider.
//
// ## Por que só três
//
// São os três que a escola vende hoje. Débito existe na Sandra e no Mercado
// Pago, e fica de fora **de propósito**: método que não se pode rotear nem
// conferir de ponta a ponta entraria aqui como promessa, e promessa de meio de
// pagamento se paga em venda perdida.

import { z } from 'zod';

export const METODOS_PAGAMENTO = ['pix', 'boleto', 'credit_card'] as const;
export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number];

export const metodoPagamentoSchema = z.enum(METODOS_PAGAMENTO);

export const ROTULO_METODO: Record<MetodoPagamento, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  credit_card: 'Cartão de crédito',
};

/**
 * Boleto exige CPF/CNPJ, e isso não é regra de um gateway — é do documento.
 *
 * A conferência mora aqui para que a tela possa desabilitar a opção **antes**
 * de a pessoa escolher: oferecer boleto sem documento faz o gateway recusar o
 * pedido inteiro, e a pessoa perde também o cartão e o pix na mesma recusa.
 */
export function exigeDocumento(metodo: MetodoPagamento): boolean {
  return metodo === 'boleto';
}
