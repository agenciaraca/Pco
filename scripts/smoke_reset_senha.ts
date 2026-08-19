/**
 * Smoke do "esqueci minha senha" — o caminho pelo qual os 1.601 alunos
 * importados vão entrar a primeira vez.
 *
 * Prova o que interessa: que o link continua valendo depois de o processo
 * reiniciar. Até 19/ago/2026 não continuava — os tokens viviam em memória — e um
 * deploy no meio de um convite em massa queimaria a leva inteira sem avisar
 * ninguém.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   npx tsx scripts/smoke_reset_senha.ts --preparar   # cria conta e pede o link
 *   pm2 restart ava-pco --update-env
 *   TOKEN=<token> npx tsx scripts/smoke_reset_senha.ts --testar
 */

import * as store from '../server/auth/users-store';
import { createResetToken, peekResetToken, consumeResetToken } from '../server/auth/password-reset';

const PREPARAR = process.argv.includes('--preparar');
const TESTAR = process.argv.includes('--testar');
const EMAIL = 'smoke.reset@pco.local';
const log = (m: string) => console.log(`[smoke-reset] ${m}`);

let falhas = 0;
const checa = (c: boolean, d: string) => {
  if (c) log(`  ok    ${d}`);
  else {
    falhas++;
    log(`  FALHA ${d}`);
  }
};

async function main(): Promise<void> {
  await store.loadUsers();

  if (PREPARAR) {
    const antiga = await store.findUserByEmail(EMAIL);
    if (antiga) await store.deleteUser(antiga.id);
    const u = await store.createUser({
      email: EMAIL,
      name: 'Smoke de redefinição',
      role: 'student',
      password: store.generatePassword(20),
    });
    const t = await createResetToken(u.id, EMAIL);
    log(`conta: ${u.id}`);
    log(`TOKEN=${t.token}`);
    log(`vale até: ${new Date(t.expiresAt).toISOString()}`);
    log('agora: pm2 restart ava-pco --update-env  →  TOKEN=... npx tsx scripts/smoke_reset_senha.ts --testar');
    return;
  }

  if (!TESTAR) {
    log('informe --preparar ou --testar');
    process.exitCode = 1;
    return;
  }

  const token = process.env.TOKEN;
  if (!token) {
    log('defina TOKEN=<o token impresso no --preparar>');
    process.exitCode = 1;
    return;
  }

  // O ponto do teste: isto roda DEPOIS do restart.
  const espiado = await peekResetToken(token);
  checa(!!espiado, 'o link continua válido depois do restart do processo');
  checa(espiado?.email === EMAIL, 'o link aponta para a conta certa');

  const consumido = await consumeResetToken(token);
  checa(!!consumido, 'o link pode ser consumido');

  if (consumido) {
    const novaSenha = store.generatePassword(20);
    const trocou = await store.changePassword(consumido.userId, novaSenha);
    checa(trocou, 'a senha foi trocada com o link');
    const entra = await store.verifyPassword(EMAIL, novaSenha);
    checa(!!entra, 'a conta entra com a senha nova');
  }

  checa(!(await consumeResetToken(token)), 'o mesmo link não serve duas vezes');

  const conta = await store.findUserByEmail(EMAIL);
  if (conta) await store.deleteUser(conta.id);
  log('conta de teste removida');

  log('');
  if (falhas === 0) log('TUDO OK — o convite de primeiro acesso sobrevive a deploy.');
  else {
    log(`${falhas} FALHA(S).`);
    process.exitCode = 1;
  }
}

void main();
