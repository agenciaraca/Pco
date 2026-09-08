/**
 * O preenchimento pelo CEP, no HTML que o site realmente serve.
 *
 * O teste irmão (`cep-preenche-endereco.test.ts`) prova a rota. Este prova a
 * outra metade: o formulário do checkout tem onde pôr o aviso, e o script do
 * site faz com ele o que foi combinado.
 *
 * Ele nasceu com um achado de verdade dentro. `server/public/client.ts` é um
 * template literal gigante, e **barra invertida some ali do mesmo jeito que a
 * crase quebra o arquivo**: a máscara de CEP escrita como `/\D/g` chegava ao
 * navegador como `/D/g` — apagava a letra D e deixava passar o hífen. Quem
 * digitasse o oitavo dígito via "12345--67" no campo. A máscara subiu assim em
 * 7/set/2026 e a suíte inteira ficou verde, porque nada avaliava o script.
 *
 * O script é avaliado UMA vez: seus ouvintes vivem em `document`, e avaliá-lo
 * por caso empilharia handlers — dois preenchimentos por tecla.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUBLIC_JS } from '../server/public/client';

let tmpDir: string;
let corpoDoCheckout = '';

const campo = (nome: string) =>
  document.querySelector(`[name="${nome}"]`) as HTMLInputElement | HTMLSelectElement;
const aviso = () => document.querySelector('[data-cep-aviso]') as HTMLElement;

/** Digitar de verdade: o valor muda e o evento sobe, como no navegador. */
function digita(nome: string, valor: string) {
  const el = campo(nome);
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Deixa as promessas do fetch resolverem. */
const assenta = () => new Promise((r) => setTimeout(r, 0));

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ENDERECO = {
  encontrado: true,
  endereco: {
    cep: '01001000',
    logradouro: 'Praça da Sé',
    bairro: 'Sé',
    cidade: 'São Paulo',
    uf: 'SP',
  },
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cep-dom-'));
  process.env.DATA_DIR = tmpDir;

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify([
      {
        id: 'c-1',
        slug: 'formacao-teste',
        title: 'Formação de Teste',
        description: 'Uma formação para o checkout.',
        coverColor: 'from-pco-blue to-pco-cyan',
        totalHours: 40,
        certificateAvailable: true,
        tags: [],
        modules: [],
      },
    ]),
    'utf8',
  );
  const agora = new Date().toISOString();
  await fs.writeFile(
    path.join(tmpDir, 'payment-products.json'),
    JSON.stringify([
      {
        id: 'p-1',
        name: 'Formação de Teste',
        kind: 'course',
        refId: 'c-1',
        priceCents: 99900,
        currency: 'BRL',
        active: true,
        createdAt: agora,
        updatedAt: agora,
      },
    ]),
    'utf8',
  );

  const { publicSite } = await import('../server/public/router');
  const res = await publicSite.fetch(new Request('http://local/checkout?curso=formacao-teste'));
  expect(res.status, 'o checkout não respondeu 200').toBe(200);
  const html = await res.text();
  corpoDoCheckout = html.slice(html.indexOf('<body'), html.indexOf('</body>'));
  corpoDoCheckout = corpoDoCheckout.slice(corpoDoCheckout.indexOf('>') + 1);

  new Function(PUBLIC_JS)();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  document.body.innerHTML = corpoDoCheckout;
  // O último CEP consultado vive no fechamento do script, não no DOM. Um CEP
  // curto o zera — sem isto, o segundo caso com o mesmo número não pediria nada.
  digita('cep', '');
  vi.unstubAllGlobals();
});

describe('a máscara de CEP', () => {
  it('apaga o que não é dígito — e não só a letra D', () => {
    // Este caso falha contra o código de 7/set/2026: `\\D` virava `D` dentro do
    // template literal, o hífen sobrevivia, e o campo mostrava "12345--67".
    digita('cep', '12345-678');
    expect((campo('cep') as HTMLInputElement).value).toBe('12345-678');

    digita('cep', 'ab12cd345678xy');
    expect((campo('cep') as HTMLInputElement).value).toBe('12345-678');
  });
});

describe('preenchimento pelo CEP', () => {
  it('o formulário servido tem onde dizer o que aconteceu', () => {
    expect(corpoDoCheckout).toContain('data-cep-aviso');
    expect(corpoDoCheckout).toContain('role="status"');
  });

  it('CEP completo preenche os quatro campos e leva o foco para o número', async () => {
    const chamou = vi.fn(async (_url: string) => resposta(ENDERECO));
    vi.stubGlobal('fetch', chamou);

    (campo('cep') as HTMLInputElement).focus();
    digita('cep', '01001000');
    await assenta();

    expect(chamou).toHaveBeenCalledTimes(1);
    expect(String(chamou.mock.calls[0][0])).toContain('/api/public/cep/01001000');
    expect(campo('logradouro').value).toBe('Praça da Sé');
    expect(campo('bairro').value).toBe('Sé');
    expect(campo('cidade').value).toBe('São Paulo');
    expect(campo('uf').value).toBe('SP');
    // O número é o único campo que o CEP nunca traz.
    expect(document.activeElement).toBe(campo('numero'));
    expect(aviso().textContent).toBe('');
  });

  it('não pisa no que a pessoa digitou à mão', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(ENDERECO)));
    campo('logradouro').value = 'Rua que eu sei o nome';
    digita('cep', '01001000');
    await assenta();

    expect(campo('logradouro').value).toBe('Rua que eu sei o nome');
    // O resto, que estava vazio, foi preenchido.
    expect(campo('cidade').value).toBe('São Paulo');
  });

  it('corrigir o CEP refaz o que veio do CEP anterior', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(ENDERECO)));
    digita('cep', '01001000');
    await assenta();
    expect(campo('cidade').value).toBe('São Paulo');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          encontrado: true,
          endereco: {
            cep: '30140071',
            logradouro: 'Rua da Bahia',
            bairro: 'Centro',
            cidade: 'Belo Horizonte',
            uf: 'MG',
          },
        }),
      ),
    );
    digita('cep', '30140071');
    await assenta();
    expect(campo('cidade').value).toBe('Belo Horizonte');
    expect(campo('uf').value).toBe('MG');
  });

  it('CEP inexistente diz que não achou', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ encontrado: false })));
    digita('cep', '99999999');
    await assenta();

    expect(aviso().textContent).toMatch(/não encontrado/i);
    expect(campo('cidade').value).toBe('');
  });

  it('serviço fora do ar NÃO diz "não encontrado" — e não trava a compra', async () => {
    // A regra inteira deste sprint, do lado do navegador.
    for (const falha of [
      async () => resposta({ error: { code: 'CEP_INDISPONIVEL' } }, 503),
      () => Promise.reject(new Error('sem rede')),
    ]) {
      document.body.innerHTML = corpoDoCheckout;
      digita('cep', '');
      vi.stubGlobal('fetch', vi.fn(falha));
      digita('cep', '01001000');
      await assenta();

      expect(aviso().textContent).not.toMatch(/não encontrado/i);
      expect(aviso().textContent).toMatch(/à mão/i);
      // Os campos continuam vazios e editáveis: dá para digitar e comprar.
      expect(campo('cidade').value).toBe('');
      expect((campo('cidade') as HTMLInputElement).disabled).toBe(false);
    }
  });

  it('CEP incompleto não consulta nada', async () => {
    const chamou = vi.fn(async () => resposta(ENDERECO));
    vi.stubGlobal('fetch', chamou);
    digita('cep', '0100100');
    await assenta();
    expect(chamou).not.toHaveBeenCalled();
  });
});
