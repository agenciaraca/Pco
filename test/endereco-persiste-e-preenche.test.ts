/**
 * Nascimento e endereço deixam de sumir depois da compra.
 *
 * O checkout coleta os dois desde 7/set/2026 porque o Asaas recusa boleto sem
 * CEP e sem número. Até 8/set eles iam para o cadastro do gateway e **nada era
 * guardado aqui** — com duas consequências:
 *
 * - quem comprava o segundo curso redigitava seis campos, e é por isso que a
 *   tela do aluno logado pedia endereço como *opcional*: exigir sem ter de
 *   onde preencher obrigaria a redigitar tudo a cada compra;
 * - o titular que pedia exportação ou exclusão não via nem apagava um endereço
 *   que a escola de fato coletou. Dado pessoal fora das duas pontas da LGPD é
 *   exatamente o defeito que o fórum e a transcrição de sessão tinham.
 *
 * O que este arquivo trava:
 *
 * 1. **O campo cabe no banco.** É a guarda do "campo sem coluna": três vezes
 *    neste projeto um campo existiu no schema e no formulário e não tinha
 *    coluna — o caminho de banco descartava o valor ao gravar e devolvia
 *    `undefined` ao ler, sem erro nenhum.
 * 2. **Compra sem endereço não apaga o endereço anterior.** Na tela do aluno o
 *    endereço é opcional fora do boleto; gravar `null` por cima destruiria
 *    justamente o que se quer preencher da próxima vez.
 * 3. **A anonimização leva os dois.** Deixar o endereço ao lado do "Titular
 *    removido" seria anonimização de fachada — foi assim que a referência
 *    externa sobreviveu, em 5/set.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as schema from '../server/db/schema';
import { createSystemUserSchema, updateSystemUserSchema } from '../shared/schemas';

let tmpDir: string;
let store: typeof import('../server/auth/users-store');
let app: { fetch: (req: Request) => Response | Promise<Response> };

const ENDERECO = {
  cep: '01310100',
  logradouro: 'Avenida Paulista',
  numero: '1578',
  complemento: 'conjunto 12',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP' as const,
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-endereco-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/auth/users-store');
  const mod = await import('../server/app');
  app = mod.buildApp() as unknown as typeof app;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('o campo cabe no banco', () => {
  it('a tabela users tem coluna para nascimento e endereço', () => {
    const colunas = Object.keys(schema.users);
    expect(colunas).toContain('birthDate');
    expect(colunas).toContain('address');
  });

  it('as colunas guardam o que o checkout valida', () => {
    // `birthDate` é texto `AAAA-MM-DD`, e não `date`: o tipo do Postgres volta
    // como Date e passa por fuso — 1990-03-15 vira 1990-03-14 a oeste de
    // Greenwich. Data de nascimento não tem hora.
    expect(schema.users.birthDate.dataType).toBe('string');
    // O endereço são sete campos lidos sempre inteiros, para preencher
    // formulário e montar o cadastro no gateway.
    expect(schema.users.address.dataType).toBe('json');
  });

  it('nada disto entrou no schema público de criação de conta', () => {
    // Quem grava é o checkout, com o que o titular digitou sobre si. Se estes
    // campos aparecerem aqui, alguém abriu um caminho de escrita pela API de
    // administração — que é o mesmo cuidado que o `document` já tem.
    for (const esquema of [createSystemUserSchema, updateSystemUserSchema]) {
      const campos = Object.keys(esquema.shape);
      expect(campos).not.toContain('birthDate');
      expect(campos).not.toContain('endereco');
      expect(campos).not.toContain('address');
    }
  });
});

describe('gravar e ler', () => {
  it('guarda o que a pessoa digitou e devolve na leitura', async () => {
    const u = await store.createUser({
      email: 'compra@exemplo.test',
      name: 'Quem Compra',
      role: 'student',
      password: 'senha-de-teste-123',
    });
    await store.salvarDadosDeCobranca(u.id, { birthDate: '1990-03-15', endereco: ENDERECO });

    const lido = await store.findUserById(u.id);
    expect(lido?.birthDate).toBe('1990-03-15');
    expect(lido?.endereco).toEqual(ENDERECO);
  });

  it('compra sem endereço NÃO apaga o endereço da compra anterior', async () => {
    const u = await store.createUser({
      email: 'segunda@exemplo.test',
      name: 'Segunda Compra',
      role: 'student',
      password: 'senha-de-teste-123',
    });
    await store.salvarDadosDeCobranca(u.id, { birthDate: '1985-07-01', endereco: ENDERECO });
    // Na tela do aluno logado o endereço é opcional fora do boleto.
    await store.salvarDadosDeCobranca(u.id, { birthDate: undefined, endereco: undefined });

    const lido = await store.findUserById(u.id);
    expect(lido?.endereco).toEqual(ENDERECO);
    expect(lido?.birthDate).toBe('1985-07-01');
  });

  it('a leitura não vaza credencial — é a projeção pública', async () => {
    const u = await store.createUser({
      email: 'projecao@exemplo.test',
      name: 'Projeção',
      role: 'student',
      password: 'senha-de-teste-123',
    });
    const lido = (await store.findUserById(u.id)) as Record<string, unknown> | null;
    expect(lido).not.toBeNull();
    expect(lido).not.toHaveProperty('passwordHash');
    expect(lido).not.toHaveProperty('totpSecretEncrypted');
  });
});

describe('LGPD', () => {
  it('a anonimização leva nascimento e endereço junto com o CPF', async () => {
    const u = await store.createUser({
      email: 'expurgo@exemplo.test',
      name: 'Vai Sair',
      role: 'student',
      password: 'senha-de-teste-123',
    });
    await store.salvarDadosDeCobranca(u.id, { birthDate: '1970-12-31', endereco: ENDERECO });

    const ok = await store.anonimizarConta(u.id, {
      nome: 'Titular removido',
      email: 'removido-abc@invalido.local',
    });
    expect(ok).toBe(true);

    const depois = await store.findUserById(u.id);
    expect(depois?.birthDate ?? null).toBeNull();
    expect(depois?.endereco ?? null).toBeNull();
    // O CPF já saía; o endereço ficar ao lado do "Titular removido" tornaria a
    // anonimização de fachada.
    expect(depois?.document ?? null).toBeNull();
  });
});

describe('GET /me/dados-de-cobranca', () => {
  it('não responde sem token — endereço é de quem o digitou', async () => {
    const res = await app.fetch(new Request('http://local/api/me/dados-de-cobranca'));
    expect(res.status).toBe(401);
  });
});
