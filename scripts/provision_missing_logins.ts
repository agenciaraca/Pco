/**
 * Cria a credencial de quem existe no banco mas não consegue entrar.
 *
 * O AVA guarda credencial (bcrypt, tokenVersion, 2FA) em `data/users.json` e a
 * pessoa como aluno na tabela `users` do Postgres. Quem entra por um caminho que
 * escreve só no banco — a carga da migração, o sincronizador da loja — aparece no
 * admin com matrícula e progresso e mesmo assim não consegue fazer login. O
 * "esqueci minha senha" também não ajuda: ele procura no store de credenciais, e
 * a pessoa não está lá.
 *
 * O id é copiado do banco, não gerado. É o detalhe que faz a diferença entre
 * resolver e trocar um problema por outro: o token de sessão carrega o id do
 * login (`sub`), e é por ele que o AVA busca ficha, matrículas e progresso. Id
 * novo = a pessoa entra e vê uma plataforma vazia.
 *
 * A senha criada é aleatória e não é comunicada a ninguém — serve só para o
 * registro existir. O aluno entra pelo "esqueci minha senha", que agora encontra
 * a conta. Ninguém recebe e-mail por causa deste script.
 *
 * Rode dentro de ~/ava-pco no VPS, onde estão o JSON e o DATABASE_URL.
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/provision_missing_logins.ts
 *   DATABASE_URL=... npx tsx scripts/provision_missing_logins.ts --apply
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const log = (m: string) => console.log(`[provisiona-login] ${m}`);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BCRYPT_ROUNDS = 11;

interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
  customRoleSlug?: string | null;
  passwordHash: string;
  tokenVersion: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  document?: string | null;
}

function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

async function main(): Promise<void> {
  log(`modo: ${APPLY ? '*** APPLY (grava) ***' : 'DRY-RUN (não grava)'}`);

  const login = JSON.parse(await fs.readFile(USERS_FILE, 'utf8')) as LoginUser[];
  const porEmail = new Map(login.map((u) => [u.email.toLowerCase(), u]));
  const porId = new Map(login.map((u) => [u.id, u]));

  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL!),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let novos: LoginUser[] = [];
  try {
    const banco = (
      await client.query(
        `select u.id, u.email, u.name, u.role, u.created_at,
                (select count(*) from enrollments e where e.student_id = u.id)::int as matriculas
           from users u where u.role = 'student'`,
      )
    ).rows as Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: Date;
      matriculas: number;
    }>;

    log(`banco: ${banco.length} aluno(s) · credenciais existentes: ${login.length}`);

    const faltando = banco.filter((r) => !porEmail.has((r.email ?? '').toLowerCase()));
    log(`sem credencial: ${faltando.length}`);
    if (faltando.length === 0) {
      log('nada a fazer — todos conseguem tentar entrar');
      return;
    }

    // Um id do banco que já pertence a outra credencial seria colisão: o token
    // levaria à ficha errada. Preferimos pular e denunciar a gravar torto.
    const colisoes = faltando.filter((r) => porId.has(r.id));
    if (colisoes.length > 0) {
      log(`AVISO: ${colisoes.length} conta(s) com id já usado por outra credencial — puladas:`);
      for (const c of colisoes.slice(0, 10)) console.log(`  ${c.id} · ${c.email}`);
    }

    const agora = new Date().toISOString();
    novos = [];
    for (const r of faltando) {
      if (porId.has(r.id)) continue;
      const senha = crypto.randomBytes(24).toString('hex');
      novos.push({
        id: r.id, // do banco, sempre
        email: (r.email ?? '').toLowerCase(),
        name: r.name || r.email,
        role: 'student',
        customRoleSlug: null,
        passwordHash: await bcrypt.hash(senha, BCRYPT_ROUNDS),
        tokenVersion: 0,
        createdAt: (r.created_at ?? new Date()).toISOString(),
        updatedAt: agora,
        active: true,
        document: null,
      });
    }

    const comMatricula = faltando.filter((r) => r.matriculas > 0).length;
    log(`a criar: ${novos.length} credencial(is) · ${comMatricula} dessas pessoas têm matrícula`);
    for (const n of novos.slice(0, 10)) console.log(`  ${n.id.padEnd(24)} ${n.email}`);
    if (novos.length > 10) console.log(`  … e mais ${novos.length - 10}`);
  } finally {
    await client.end();
  }

  if (!APPLY) {
    log('DRY-RUN: nada gravado. Rode com --apply para aplicar.');
    return;
  }
  if (novos.length === 0) return;

  const backup = `${USERS_FILE}.bak-${Date.now()}`;
  await fs.copyFile(USERS_FILE, backup);
  await fs.writeFile(USERS_FILE, JSON.stringify([...login, ...novos], null, 2));
  log(`gravado: ${login.length + novos.length} credenciais no total. backup em ${path.basename(backup)}`);
  log('IMPORTANTE: reinicie o app — o store de credenciais é lido para a memória no boot.');
  log('  pm2 restart ava-pco --update-env');
}

void main();
