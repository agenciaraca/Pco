/**
 * Smoke test do login pela porta da frente, contra o processo que está no ar.
 *
 * Em duas fases, e o motivo é o próprio desenho do store: a aplicação carrega a
 * lista de contas para a memória no boot e só relê ao reiniciar. Conta criada
 * por outro processo — como este script — não existe para quem está servindo até
 * o restart. Vale para os dois backends; não é peculiaridade do banco.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   npx tsx scripts/smoke_login.ts --preparar      # cria a conta, imprime a senha
 *   pm2 restart ava-pco --update-env              # o processo passa a enxergá-la
 *   SENHA=<a senha> npx tsx scripts/smoke_login.ts --testar
 */

import * as store from '../server/auth/users-store';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3035';
const PREPARAR = process.argv.includes('--preparar');
const TESTAR = process.argv.includes('--testar');
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

  if (!PREPARAR && !TESTAR) {
    log('informe --preparar ou --testar (veja o cabeçalho do arquivo)');
    process.exitCode = 1;
    return;
  }

  await store.loadUsers();

  if (PREPARAR) {
    const senha = store.generatePassword(20);
    const antiga = await store.findUserByEmail(EMAIL);
    if (antiga) await store.deleteUser(antiga.id);
    const criada = await store.createUser({
      email: EMAIL,
      name: 'Smoke de login',
      role: 'student',
      password: senha,
    });
    log(`conta criada: ${criada.id}`);
    log(`SENHA=${senha}`);
    log('agora: reinicie o app e rode o mesmo script com --testar, passando a senha acima na variável de ambiente');
    return;
  }

  const senha = process.env.SENHA;
  if (!senha) {
    log('defina SENHA=<a senha impressa no --preparar>');
    process.exitCode = 1;
    return;
  }
  const criada = await store.findUserByEmail(EMAIL);
  if (!criada) {
    log('conta de teste não existe — rode --preparar primeiro');
    process.exitCode = 1;
    return;
  }

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
