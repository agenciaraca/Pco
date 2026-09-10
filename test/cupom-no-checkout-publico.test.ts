/**
 * O checkout público aceitava o cupom e o jogava fora.
 *
 * `publicCheckoutSchema` declara `couponCode` desde que o cupom existe, e o
 * checkout do **aluno logado** sempre o aplicou. Na rota pública — que é por
 * onde entra a venda de quem ainda não é aluno, ou seja, a maioria — o valor
 * era validado pelo Zod, entrava no corpo, e **nenhuma linha o lia**.
 *
 * O efeito: quem tivesse um cupom pagaria o preço cheio. Sem erro, sem aviso,
 * com o pedido gravado no valor errado e o gateway cobrando esse valor.
 *
 * É a mesma classe do CPF que não chegava ao Asaas e do campo de aula sem
 * coluna — coletado, validado e descartado em silêncio na última curva. Só que
 * aqui o descarte cobra dinheiro a mais de quem comprou.
 *
 * O dono relatou como "cadastrei um cupom e não aparece campo no checkout".
 * Faltava o campo, sim — e atrás dele faltava a aplicação, que é o que
 * transformaria o campo novo em promessa quebrada.
 *
 * Os casos abaixo cobram a **regra**, lendo o código servido e o do servidor:
 * o campo existe na tela, o script o envia, e o servidor o aplica nos três
 * lugares onde o valor aparece (pedido pendente equivalente, pedido gravado e
 * cobrança). Aplicar num só deixaria o pedido dizendo um preço e o gateway
 * cobrando outro.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const ler = (p: string) => fs.readFile(path.join(raiz, p), 'utf8');

describe('o campo existe na tela', () => {
  it('o checkout público tem campo de cupom', async () => {
    const router = await ler('server/public/router.ts');
    expect(router).toContain('name="couponCode"');
  });

  it('e ele é declarado opcional, para não parecer obrigatório', async () => {
    const router = await ler('server/public/router.ts');
    const i = router.indexOf('name="couponCode"');
    const bloco = router.slice(Math.max(0, i - 900), i);
    expect(bloco).toMatch(/se tiver|opcional/i);
  });
});

describe('o script envia o que o campo coleta', () => {
  it('o couponCode entra no corpo do checkout', async () => {
    const client = await ler('server/public/client.ts');
    expect(client).toMatch(/couponCode:\s*g\('couponCode'\)/);
  });

  it('vazio não é enviado como string vazia', async () => {
    // Mandar "" faria o servidor procurar um cupom de código vazio e recusar
    // a compra de quem não tem cupom nenhum.
    const client = await ler('server/public/client.ts');
    expect(client).toMatch(/couponCode:\s*g\('couponCode'\)\s*\|\|\s*undefined/);
  });
});

describe('o servidor aplica, e aplica nos três lugares', () => {
  it('a rota pública lê o couponCode', async () => {
    const app = await ler('server/app.ts');
    const i = app.indexOf(`app.post('/public/checkout'`);
    expect(i, 'não achei a rota pública').toBeGreaterThan(0);
    const rota = app.slice(i, i + 14000);
    expect(rota).toContain('v.data.couponCode');
    expect(rota).toContain('couponsRepo.validateCoupon');
  });

  it('o valor com desconto vale no pedido, na busca por pendente e na cobrança', async () => {
    const app = await ler('server/app.ts');
    const i = app.indexOf(`app.post('/public/checkout'`);
    const rota = app.slice(i, i + 14000);
    // Nenhum dos três pode ter voltado a usar o preço cheio.
    expect(rota).not.toContain('amountCents: product.priceCents');
  });

  it('cupom inválido recusa a compra com o MOTIVO, não com "inválido"', async () => {
    const app = await ler('server/app.ts');
    const i = app.indexOf(`app.post('/public/checkout'`);
    const rota = app.slice(i, i + 14000);
    expect(rota).toContain('COUPON_INVALID');
    // `valid.reason` é a frase do repo ("expirado", "não vale para este
    // curso"): é ela que a pessoa lê abaixo do campo.
    expect(rota).toMatch(/COUPON_INVALID',\s*valid\.reason/);
  });

  it('o uso do cupom é anotado — senão o limite de usos nunca chega', async () => {
    // Não há coluna de cupom no pedido: quem incrementa o contador é o webhook
    // de pagamento, procurando `couponId=` na nota do histórico.
    const app = await ler('server/app.ts');
    const i = app.indexOf(`app.post('/public/checkout'`);
    const rota = app.slice(i, i + 14000);
    expect(rota).toMatch(/couponId=\$\{appliedCouponId\}/);
  });
});

describe('as duas rotas de compra não podem divergir', () => {
  it('as duas aplicam cupom', async () => {
    // Elas já divergiram antes: até 2/set/2026 a do aluno logado mandava ao
    // gateway só o e-mail e nenhuma compra por dentro do app se concluía.
    const app = await ler('server/app.ts');
    const publico = app.indexOf(`app.post('/public/checkout'`);
    const logado = app.indexOf(`'/payments/checkout'`);
    for (const [nome, i] of [
      ['pública', publico],
      ['do aluno logado', logado],
    ] as const) {
      const rota = app.slice(i, i + 14000);
      expect(rota.includes('couponsRepo.validateCoupon'), `a rota ${nome} não aplica cupom`).toBe(
        true,
      );
    }
  });
});
