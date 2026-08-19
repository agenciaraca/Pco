/**
 * Prova que o backend de credencial escolhido realmente autentica.
 *
 * Feito para rodar ANTES e DEPOIS de virar AUTH_STORE=db em produção: lê o
 * store, confere que as contas chegaram, e faz o ciclo completo com uma conta
 * descartável — cria, acerta a senha, erra a senha, apaga. Sem isso, ligar a
 * chave seria confiar que a migração deu certo porque não reclamou.
 *
 * Uso:
 *   AUTH_STORE=db DATABASE_URL=... npx tsx scripts/verify_auth_backend.ts
 *   DATABASE_URL=... npx tsx scripts/verify_auth_backend.ts        # backend de arquivo
 */

import * as store from '../server/auth/users-store';

const log = (m: string) => console.log(`[verifica-auth] ${m}`);
const EMAIL_TESTE = 'verificacao.backend@pco.local';

let falhas = 0;
function checa(condicao: boolean, descricao: string): void {
  if (condicao) {
    log(`  ok    ${descricao}`);
  } else {
    falhas++;
    log(`  FALHA ${descricao}`);
  }
}

async function main(): Promise<void> {
  const modo = process.env.AUTH_STORE === 'db' ? 'BANCO (AUTH_STORE=db)' : 'ARQUIVO (padrão)';
  log(`backend: ${modo}`);

  await store.loadUsers();
  const todos = await store.listUsers();
  log(`contas carregadas: ${todos.length}`);
  checa(todos.length > 0, 'o store carregou alguma conta');

  const admins = todos.filter((u) => u.role === 'admin' || u.role === 'superadmin');
  checa(admins.length > 0, `existe conta administrativa (${admins.length})`);
  checa(
    todos.every((u) => !('passwordHash' in u)),
    'nenhuma conta expõe o hash da senha na leitura pública',
  );

  // Ciclo completo com conta descartável.
  const anterior = await store.findUserByEmail(EMAIL_TESTE);
  if (anterior) {
    await store.deleteUser(anterior.id);
    log('conta de verificação anterior removida');
  }

  const senha = store.generatePassword(20);
  const criada = await store.createUser({
    email: EMAIL_TESTE,
    name: 'Verificação de backend',
    role: 'student',
    password: senha,
  });
  checa(!!criada.id, 'criou a conta de verificação');

  const achada = await store.findUserByEmail(EMAIL_TESTE);
  checa(achada?.id === criada.id, 'encontrou a conta recém-criada pelo e-mail');

  const certa = await store.verifyPassword(EMAIL_TESTE, senha);
  checa(!!certa, 'aceita a senha correta');

  const errada = await store.verifyPassword(EMAIL_TESTE, senha + 'x');
  checa(!errada, 'recusa a senha errada');

  await store.deleteUser(criada.id);
  const sumiu = await store.findUserByEmail(EMAIL_TESTE);
  checa(!sumiu, 'removeu a conta de verificação');

  log('');
  if (falhas === 0) {
    log('TUDO OK — este backend autentica.');
  } else {
    log(`${falhas} FALHA(S) — não vire a chave / reverta.`);
    process.exitCode = 1;
  }
}

void main();
