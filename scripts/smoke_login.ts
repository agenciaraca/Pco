/**
 * Smoke test do login pela porta da frente: cria uma conta descartável, faz
 * POST /auth/login por HTTP contra o processo que está no ar, confere o token e
 * apaga a conta.
 *
 * O verificador de backend prova que o store autentica; este prova que a
 * aplicação em execução autentica — que é outra coisa, porque o processo tem o
 * store carregado em memória desde o boot e pode estar servindo um estado
 * diferente do que está gravado.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... AUTH_STORE=db npx tsx scripts/smoke_login.ts
 *   BASE=http://127.0.0.1:3035 npx tsx scripts/smoke_login.ts
 */

import * as store from '../server/auth/users-store';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3035';
const EMAIL = 'smoke.login@pco.local';
const log = (m: string) => console.log(`[smoke-login] ${m}`);

let falhas = 0;
function checa(cond: boolean, desc: string): void {
  if (cond) log(`  ok    ${desc}`);
  else {
    falhas++;
    log(`  FALHA ${desc}`);
  }
}

async function main(): Promise<void> {
  log(`alvo: ${BASE} · backend: ${process.env.AUTH_STORE === 'db' ? 'banco' : 'arquivo'}`);
  const senha = store.generatePassword(20);

  await store.loadUsers();
  const antiga = await store.findUserByEmail(EMAIL);
  if (antiga) await store.deleteUser(antiga.id);
  const criada = await store.createUser({
    email: EMAIL,
    name: 'Smoke de login',
    role: 'student',
    password: senha,
  });
  log(`conta de teste criada: ${criada.id}`);

  try {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: senha }),
    });
    const corpo = (await r.json()) as { token?: string; error?: { code?: string } };
    checa(r.status === 200, `login responde 200 (veio ${r.status})`);
    checa(typeof corpo.token === 'string' && corpo.token.length > 20, 'devolve um token');

    if (typeof corpo.token === 'string') {
      // O token precisa servir para alguma coisa: chama uma rota autenticada.
      const eu = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${corpo.token}` },
      });
      checa(eu.status === 200, `o token abre uma rota autenticada (veio ${eu.status})`);
    }

    const errado = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: senha + 'x' }),
    });
    checa(errado.status === 401, `senha errada é recusada com 401 (veio ${errado.status})`);
  } finally {
    await store.deleteUser(criada.id);
    log('conta de teste removida');
  }

  log('');
  if (falhas === 0) log('TUDO OK — a aplicação no ar está autenticando.');
  else {
    log(`${falhas} FALHA(S) — reverta o backend de credencial.`);
    process.exitCode = 1;
  }
}

void main();
