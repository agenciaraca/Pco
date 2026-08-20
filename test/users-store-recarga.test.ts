import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-recarga-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  delete process.env.AUTH_STORE;
  return dir;
});

import * as store from '../server/auth/users-store';

// A lista de contas é lida no boot e vive em memória. Conta criada por outro
// processo — script de migração, sincronizador da loja, SQL direto — não existe
// para quem está servindo, e o sintoma é cruel: a pessoa recebe o convite,
// clica no link, define a senha e leva "usuário não encontrado", com a conta
// inteira lá no banco. Em 20/ago isso reprovou a jornada do convidado.

describe('store relê quando alguém procurado não está na memória', () => {
  beforeAll(async () => {
    await store.loadUsers();
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('acha quem foi gravado no backend por fora, sem reiniciar', async () => {
    const email = 'criado.por.fora@pco.local';
    const arquivo = `${TMP_DIR}/users.json`;
    const atual = JSON.parse(await fs.readFile(arquivo, 'utf8')) as Array<Record<string, unknown>>;

    // Simula o que um script faz: escreve direto no backend, sem passar pelo
    // processo que está servindo.
    atual.push({
      id: 'stude-por-fora',
      email,
      name: 'Criado Por Fora',
      role: 'student',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true,
    });
    await fs.writeFile(arquivo, JSON.stringify(atual, null, 2));

    const achado = await store.findUserByEmail(email);
    expect(achado, 'a conta existe no backend e precisa ser encontrada').not.toBeNull();
    expect(achado?.id).toBe('stude-por-fora');
  });

  it('troca a senha de quem apareceu por fora — é o passo do convite', async () => {
    const ok = await store.changePassword('stude-por-fora', 'senha-nova-bem-comprida');
    expect(ok).toBe(true);
    const entra = await store.verifyPassword('criado.por.fora@pco.local', 'senha-nova-bem-comprida');
    expect(entra).toBeTruthy();
  });

  it('e-mail que nunca existiu continua devolvendo nulo', async () => {
    expect(await store.findUserByEmail('ninguem@pco.local')).toBeNull();
  });
});
