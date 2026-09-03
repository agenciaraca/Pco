// Comparação de segredo em tempo constante.
//
// Vive num arquivo próprio porque é a mesma regra em dois provedores, e regra
// repetida diverge — foi o que aconteceu até 3/set/2026: o Pagar.me comparava
// em tempo constante e falhava fechado; o Asaas comparava com `!==` e, sem
// `webhookSecret` cadastrado, **nem comparava** — qualquer POST anônimo era
// aceito como confirmação de pagamento.

import crypto from 'node:crypto';

export function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // `timingSafeEqual` exige mesmo tamanho; compara contra si mesmo para
    // gastar o mesmo tempo e devolve false.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}
