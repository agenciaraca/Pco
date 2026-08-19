/**
 * Convite de primeiro acesso para quem já era aluno antes do AVA.
 *
 * São ~1.600 pessoas que vieram da migração: têm conta, matrícula e progresso,
 * mas nunca definiram senha aqui. Este script gera um link por pessoa e envia o
 * e-mail em lotes.
 *
 * Cuidados que o desenho leva em conta:
 *
 * - **Ensaio por padrão.** Sem `--enviar`, não sai e-mail nenhum; o script
 *   mostra quantos, para quem e como ficaria a mensagem.
 * - **Não reenvia.** Quem já entrou alguma vez (`last_login_at`) fica de fora, e
 *   quem já recebeu o convite nesta rodada é registrado em disco — a lista de
 *   enviados sobrevive a uma interrupção no meio.
 * - **Em lotes, com pausa.** Disparar 1.600 e-mails de uma vez é o caminho mais
 *   rápido para o provedor classificar o domínio como spam, e aí ninguém recebe
 *   nada — nem os transacionais.
 * - **Prazo longo.** O link de "esqueci minha senha" dura 30 minutos, o que é
 *   certo para quem clicou agora e errado para quem abre o e-mail à noite. Aqui
 *   o padrão é 7 dias, ajustável.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   npx tsx scripts/convite_primeiro_acesso.ts                       # ensaio
 *   npx tsx scripts/convite_primeiro_acesso.ts --limite=20 --enviar  # leva de teste
 *   npx tsx scripts/convite_primeiro_acesso.ts --enviar              # todos
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDb, schema } from '../server/db/client';
import { eq, and, isNull } from 'drizzle-orm';
import { createResetToken } from '../server/auth/password-reset';
import { renderPrimeiroAcesso } from '../server/notifications/templates';
import { sendSafe } from '../server/notifications/sender';

const ENVIAR = process.argv.includes('--enviar');
const num = (nome: string, padrao: number): number => {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  const v = a ? Number(a.slice(nome.length + 3)) : NaN;
  return Number.isFinite(v) && v > 0 ? v : padrao;
};

const LIMITE = num('limite', Number.MAX_SAFE_INTEGER);
const LOTE = num('lote', 40);
const PAUSA_MS = num('pausa', 20) * 1000;
const DIAS = num('dias', 7);

const BASE = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const REGISTRO = path.join(DATA_DIR, 'convite-primeiro-acesso.json');
const log = (m: string) => console.log(`[convite] ${m}`);

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lerRegistro(): Promise<Set<string>> {
  try {
    return new Set(JSON.parse(await fs.readFile(REGISTRO, 'utf8')) as string[]);
  } catch {
    return new Set();
  }
}

async function gravarRegistro(enviados: Set<string>): Promise<void> {
  await fs.writeFile(REGISTRO, JSON.stringify([...enviados], null, 2));
}

async function main(): Promise<void> {
  log(`modo: ${ENVIAR ? '*** ENVIANDO ***' : 'ENSAIO (nenhum e-mail sai)'}`);
  log(`lote: ${LOTE} · pausa entre lotes: ${PAUSA_MS / 1000}s · link vale ${DIAS} dias`);

  const db = getDb();
  if (!db) {
    log('sem DATABASE_URL — este script é para produção.');
    process.exitCode = 1;
    return;
  }

  // Quem nunca entrou. `last_login_at` é carimbado no login, então serve de
  // marca fiel de "esta pessoa ainda não usou o ambiente novo".
  const candidatos = (await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.role, 'student'), isNull(schema.users.lastLoginAt)))) as Array<{
    id: string;
    email: string;
    name: string;
  }>;

  const jaEnviados = await lerRegistro();
  const fila = candidatos
    .filter((u) => !jaEnviados.has(u.email.toLowerCase()))
    .filter((u) => /@/.test(u.email) && !u.email.endsWith('@pco.local'))
    .slice(0, LIMITE);

  log(`alunos que nunca entraram: ${candidatos.length}`);
  log(`já convidados em rodadas anteriores: ${jaEnviados.size}`);
  log(`a convidar agora: ${fila.length}`);

  if (fila.length === 0) {
    log('nada a fazer');
    return;
  }

  // Mostra a mensagem uma vez, para conferência antes de disparar.
  const amostra = renderPrimeiroAcesso({
    userName: fila[0].name,
    setPasswordUrl: `${BASE}/redefinir-senha?token=EXEMPLO`,
    expiresInDays: DIAS,
  });
  log('');
  log(`assunto: ${amostra.subject}`);
  log('texto:');
  for (const l of amostra.text.split('\n')) console.log(`    ${l}`);
  log('');

  if (!ENVIAR) {
    log('primeiros destinatários:');
    for (const u of fila.slice(0, 10)) console.log(`    ${u.email} · ${u.name}`);
    if (fila.length > 10) console.log(`    … e mais ${fila.length - 10}`);
    log('ENSAIO: nada foi enviado. Use --enviar (e considere --limite=20 na primeira leva).');
    return;
  }

  let enviados = 0;
  let falhas = 0;
  for (let i = 0; i < fila.length; i += LOTE) {
    const grupo = fila.slice(i, i + LOTE);
    for (const u of grupo) {
      // TTL longo só para este link: o padrão de 30 min é de outro caso de uso.
      const antes = process.env.RESET_TOKEN_TTL_MINUTES;
      process.env.RESET_TOKEN_TTL_MINUTES = String(DIAS * 24 * 60);
      const token = await createResetToken(u.id, u.email);
      if (antes === undefined) delete process.env.RESET_TOKEN_TTL_MINUTES;
      else process.env.RESET_TOKEN_TTL_MINUTES = antes;

      const tpl = renderPrimeiroAcesso({
        userName: u.name,
        setPasswordUrl: `${BASE}/redefinir-senha?token=${encodeURIComponent(token.token)}`,
        expiresInDays: DIAS,
      });
      const r = await sendSafe({
        to: { email: u.email, name: u.name },
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tag: 'primeiro_acesso',
      });
      if (r.ok) {
        enviados++;
        jaEnviados.add(u.email.toLowerCase());
      } else {
        falhas++;
        log(`  falhou para ${u.email}: ${r.error ?? 'motivo não informado'}`);
      }
    }
    // Grava a cada lote: uma interrupção no meio não faz ninguém receber duas vezes.
    await gravarRegistro(jaEnviados);
    log(`lote ${Math.floor(i / LOTE) + 1}: ${enviados} enviados, ${falhas} falhas (registro salvo)`);
    if (i + LOTE < fila.length) await dorme(PAUSA_MS);
  }

  log('');
  log(`fim: ${enviados} enviado(s) · ${falhas} falha(s)`);
  log(`registro em ${REGISTRO} — rodar de novo só pega quem faltou`);
}

void main();
