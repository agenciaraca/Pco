/**
 * Preenchimento de endereço pelo CEP — e a regra que ele não pode quebrar.
 *
 * O checkout público pede seis campos de endereço porque o Asaas recusa boleto
 * sem CEP e sem número. Preencher quatro deles a partir do CEP é o que impede
 * que a exigência vire desistência.
 *
 * **O que este arquivo existe para travar não é o caminho feliz.** É a
 * distinção entre "os Correios disseram que este CEP não existe" e "não deu
 * para perguntar". Achatar as duas faz a tela mandar conferir um CEP correto
 * porque um serviço de terceiro caiu por dez segundos — no exato momento em
 * que a pessoa ia pagar. É o mesmo defeito que a vitrine tinha até 7/set/2026,
 * no lugar em que ele custa a venda.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { consultarCep, limparCacheDeCep } from '../server/public/cep';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SE_01001000 = {
  cep: '01001-000',
  logradouro: 'Praça da Sé',
  complemento: 'lado ímpar',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'SP',
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cep-'));
  process.env.DATA_DIR = tmpDir;
  const mod = await import('../server/app');
  app = mod.buildApp() as unknown as typeof app;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  limparCacheDeCep();
  vi.unstubAllGlobals();
});

describe('consulta de CEP', () => {
  it('devolve o endereço com os campos que o formulário usa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(SE_01001000)));
    const r = await consultarCep('01001-000');
    expect(r).toEqual({
      estado: 'achado',
      endereco: {
        cep: '01001000',
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    });
  });

  it('o que não tem oito dígitos nem sai da máquina', async () => {
    const chamou = vi.fn(async () => resposta(SE_01001000));
    vi.stubGlobal('fetch', chamou);
    for (const ruim of ['', '123', '0100100', '00000000', 'abcdefgh']) {
      expect((await consultarCep(ruim)).estado, ruim).toBe('invalido');
    }
    expect(chamou).not.toHaveBeenCalled();
  });

  it('CEP inexistente é inexistente — os Correios responderam', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ erro: 'true' })));
    expect((await consultarCep('99999999')).estado).toBe('inexistente');
    // Já veio como booleano em versões anteriores da API; qualquer valor
    // verdadeiro vale.
    limparCacheDeCep();
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ erro: true })));
    expect((await consultarCep('99999999')).estado).toBe('inexistente');
  });

  it('serviço fora do ar NÃO vira "CEP não existe"', async () => {
    // Este é o caso que o arquivo existe para travar.
    for (const falha of [
      () => Promise.reject(new Error('read ETIMEDOUT')),
      async () => resposta({}, 500),
      async () => new Response('<html>portal de wi-fi</html>', { status: 200 }),
      async () => resposta({ localidade: 'São Paulo' }), // sem UF
      async () => resposta({ uf: 'ZZ', localidade: 'Nárnia' }), // UF que não existe
    ]) {
      limparCacheDeCep();
      vi.stubGlobal('fetch', vi.fn(falha));
      const r = await consultarCep('01001000');
      expect(r.estado, String(falha)).toBe('indisponivel');
    }
  });

  it('o mesmo CEP não é perguntado duas vezes', async () => {
    const chamou = vi.fn(async () => resposta(SE_01001000));
    vi.stubGlobal('fetch', chamou);
    await consultarCep('01001000');
    await consultarCep('01001-000');
    expect(chamou).toHaveBeenCalledTimes(1);
  });

  it('falha não é guardada — a próxima tentativa pergunta de novo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({}, 503)));
    expect((await consultarCep('01001000')).estado).toBe('indisponivel');
    vi.stubGlobal('fetch', vi.fn(async () => resposta(SE_01001000)));
    expect((await consultarCep('01001000')).estado).toBe('achado');
  });

  it('logradouro e bairro vazios são normais — CEP de cidade inteira', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta({ cep: '76900-000', localidade: 'Ji-Paraná', uf: 'RO' })),
    );
    const r = await consultarCep('76900000');
    expect(r).toEqual({
      estado: 'achado',
      endereco: { cep: '76900000', logradouro: '', bairro: '', cidade: 'Ji-Paraná', uf: 'RO' },
    });
  });
});

describe('GET /api/public/cep/:cep', () => {
  it('achou responde 200 com o endereço', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(SE_01001000)));
    const res = await app.fetch(new Request('http://local/api/public/cep/01001000'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      encontrado: true,
      endereco: {
        cep: '01001000',
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    });
  });

  it('CEP malformado responde 400, não 503', async () => {
    const res = await app.fetch(new Request('http://local/api/public/cep/123'));
    expect(res.status).toBe(400);
  });

  it('inexistente responde 200 com encontrado:false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ erro: 'true' })));
    const res = await app.fetch(new Request('http://local/api/public/cep/99999999'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ encontrado: false });
  });

  it('indisponível responde 503 com Retry-After — nunca 404 nem encontrado:false', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede'))));
    const res = await app.fetch(new Request('http://local/api/public/cep/01001000'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const corpo = (await res.json()) as { encontrado?: boolean };
    expect(corpo.encontrado).toBeUndefined();
  });

  it('não exige token: quem está comprando ainda não tem conta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(SE_01001000)));
    const res = await app.fetch(new Request('http://local/api/public/cep/01001000'));
    expect(res.status).not.toBe(401);
  });
});
