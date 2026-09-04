// Parcelamento — a vitrine e o gateway leem daqui, e só daqui.
//
// Por que isto existe: a vitrine dizia "ou 12x de R$ X" em três telas
// (página do curso, listagem e carrinho) enquanto o pedido enviado ao Pagar.me
// oferecia `installments: [{ number: 1 }]` — uma única parcela. A pessoa
// decidia comprar por causa de uma condição que não existia no checkout, e isso
// vale sobre o item de maior ticket do catálogo. Promessa de preço que o ato da
// compra não honra é o que o CDC art. 37 chama de publicidade enganosa.
//
// Duas cópias da mesma regra acabam divergindo — foi o que aconteceu aqui, e é
// o mesmo motivo de `shared/documento.ts` e `shared/visibilidade.ts` existirem.
// Quem mudar a política de parcelas muda **este** arquivo, e os dois lados
// mudam juntos.

/**
 * Até quantas vezes a compra pode ser dividida.
 *
 * É uma decisão comercial, não técnica: mudá-la aqui muda o que a vitrine
 * anuncia e o que o gateway aceita, na mesma linha.
 */
export const PARCELAS_MAXIMAS = 12;

/**
 * Piso por parcela. Existe porque adquirente recusa parcela de centavos, e
 * porque "12x de R$ 3" não é oferta, é ruído. R$ 5 é o piso técnico usual;
 * subir isto é decisão comercial e cabe aqui.
 */
export const VALOR_MINIMO_DA_PARCELA_CENTS = 500;

/**
 * Quantas parcelas cabem num valor. Produto barato demais para o piso é
 * cobrado à vista — nunca devolve 0, porque "0x" não existe.
 */
export function parcelasPara(valorCents: number): number {
  if (!Number.isFinite(valorCents) || valorCents <= 0) return 1;
  const cabem = Math.floor(valorCents / VALOR_MINIMO_DA_PARCELA_CENTS);
  return Math.min(PARCELAS_MAXIMAS, Math.max(1, cabem));
}

/** Valor de cada parcela, para exibição. */
export function valorDaParcelaCents(valorCents: number, parcelas: number): number {
  const n = Math.max(1, Math.trunc(parcelas));
  return Math.round(valorCents / n);
}

/**
 * As opções que o gateway deve aceitar, de 1x até o máximo que couber.
 *
 * **`total` é o mesmo em todas: é parcelamento sem juros.** Isso não é detalhe
 * de implementação, é o compromisso que a vitrine já assume ao dizer
 * "12x de <preço ÷ 12>" — quem paga a taxa do parcelamento é a escola. Cobrar
 * juros exige mudar o texto da vitrine primeiro, e os dois lados saem daqui.
 */
export function opcoesDeParcelamento(valorCents: number): Array<{ number: number; total: number }> {
  const maximo = parcelasPara(valorCents);
  return Array.from({ length: maximo }, (_, i) => ({
    number: i + 1,
    total: valorCents,
  }));
}
