import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

// `json-store` e o users-store congelam caminhos no import.
const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-auth-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  // Sem AUTH_STORE, o backend é o arquivo — que é o padrão em produção hoje.
  delete process.env.AUTH_STORE;
  return dir;
});

import * as store from '../server/auth/users-store';

// A credencial passou a ter dois backends: arquivo (padrão) e colunas da tabela
// `users` do Postgres, sob AUTH_STORE=db. A troca existe porque manter login e
// aluno em bases separadas fez 63 pessoas aparecerem no admin sem conseguir
// entrar. Estes testes travam o comportamento do backend padrão e as regras que
// valem para os dois.

describe('store de credenciais — backend de arquivo', () => {
  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  beforeAll(async () => {
    await store.loadUsers();
  });

  it('semeia as contas iniciais quando não há arquivo', async () => {
    const lista = await store.listUsers();
    expect(lista.length).toBeGreaterThanOrEqual(3);
    expect(lista.some((u) => u.role === 'superadmin')).toBe(true);
  });

  it('cria conta e encontra por e-mail', async () => {
    const criado = await store.createUser({
      email: 'teste.backend@pco.local',
      name: 'Teste Backend',
      role: 'student',
      password: 'senha-bem-comprida-123',
    });
    expect(criado.id).toBeTruthy();
    const achado = await store.findUserByEmail('teste.backend@pco.local');
    expect(achado?.id).toBe(criado.id);
  });

  it('nunca devolve o hash da senha no objeto público', async () => {
    const lista = await store.listUsers();
    for (const u of lista) {
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('totpSecretEncrypted');
      expect(u).not.toHaveProperty('totpBackupCodes');
    }
  });

  it('verifica a senha correta e recusa a errada', async () => {
    const ok = await store.verifyPassword('teste.backend@pco.local', 'senha-bem-comprida-123');
    expect(ok).toBeTruthy();
    const nao = await store.verifyPassword('teste.backend@pco.local', 'senha-errada');
    expect(nao).toBeFalsy();
  });

  it('trocar a senha invalida o que foi emitido antes', async () => {
    const antes = await store.findUserByEmail('teste.backend@pco.local');
    const versaoAntes = antes!.tokenVersion;
    await store.changePassword(antes!.id, 'outra-senha-bem-comprida');
    const depois = await store.findUserByEmail('teste.backend@pco.local');

    // O middleware compara o `tv` do token com este número: subir o número é o
    // que derruba as sessões abertas com a senha antiga.
    expect(depois!.tokenVersion).toBeGreaterThan(versaoAntes);
    expect(await store.verifyPassword('teste.backend@pco.local', 'senha-errada')).toBeFalsy();
    expect(
      await store.verifyPassword('teste.backend@pco.local', 'outra-senha-bem-comprida'),
    ).toBeTruthy();
  });

  it('recusa e-mail repetido — dois logins para a mesma pessoa é ambiguidade', async () => {
    await expect(
      store.createUser({
        email: 'teste.backend@pco.local',
        name: 'Clone',
        role: 'student',
        password: 'mais-uma-senha-comprida',
      }),
    ).rejects.toThrow();
  });

  it('o que foi gravado sobrevive a uma releitura do arquivo', async () => {
    const arquivo = JSON.parse(await fs.readFile(`${TMP_DIR}/users.json`, 'utf8'));
    const gravado = arquivo.find(
      (u: { email: string }) => u.email === 'teste.backend@pco.local',
    );
    expect(gravado).toBeTruthy();
    expect(gravado.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt, não texto puro
    expect(gravado.passwordHash).not.toContain('outra-senha');
  });

  it('senha gerada tem tamanho pedido e não repete entre chamadas', () => {
    const a = store.generatePassword(16);
    const b = store.generatePassword(16);
    expect(a).toHaveLength(16);
    expect(a).not.toBe(b);
  });
});
