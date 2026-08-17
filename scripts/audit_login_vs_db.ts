/**
 * Confere se quem tem login consegue ver os próprios dados, e vice-versa.
 *
 * O AVA guarda as duas coisas em lugares diferentes: a credencial vive em
 * `data/users.json` (bcrypt, tokenVersion, 2FA) e a pessoa como aluno vive na
 * tabela `users`/`students` do Postgres. Nada mantém os dois lados em sincronia.
 *
 * O que dá errado quando divergem:
 *   - só no JSON  → entra, mas o AVA não acha ficha nem matrícula: plataforma vazia
 *   - só no banco → aparece no admin com matrícula e progresso, mas NÃO CONSEGUE
 *                   entrar; o "esqueci minha senha" também não acha a conta
 *
 * Rode dentro de ~/ava-pco no VPS, onde estão o JSON e o DATABASE_URL.
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/audit_login_vs_db.ts
 *   DATABASE_URL=... npx tsx scripts/audit_login_vs_db.ts --listar
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const LISTAR = process.argv.includes('--listar');
const log = (m: string) => console.log(`[auditoria-login] ${m}`);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

interface LoginUser {
  id: string;
  email: string;
  role: string;
  active?: boolean;
  passwordHash?: string;
}

function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

async function main(): Promise<void> {
  const login = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'users.json'), 'utf8'),
  ) as LoginUser[];
  const emailsLogin = new Map(login.map((u) => [u.email.toLowerCase(), u]));

  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL!),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const banco = (
      await client.query(
        `select lower(u.email) as email, u.id, u.role,
                (select count(*) from enrollments e where e.student_id = u.id)::int as matriculas,
                (select coalesce(sum(case when e.progress > 0 then 1 else 0 end),0)
                   from enrollments e where e.student_id = u.id)::int as com_progresso
           from users u`,
      )
    ).rows as Array<{
      email: string;
      id: string;
      role: string;
      matriculas: number;
      com_progresso: number;
    }>;
    const emailsBanco = new Map(banco.map((r) => [r.email, r]));

    log(`login (users.json): ${login.length} · banco (users): ${banco.length}`);

    const soNoBanco = banco.filter((r) => !emailsLogin.has(r.email));
    const soNoLogin = login.filter((u) => !emailsBanco.has(u.email.toLowerCase()));

    const bloqueadosComMatricula = soNoBanco.filter((r) => r.matriculas > 0);
    const bloqueadosComProgresso = soNoBanco.filter((r) => r.com_progresso > 0);

    log('');
    log(`SÓ NO BANCO — não conseguem entrar: ${soNoBanco.length}`);
    log(`  destes, com matrícula: ${bloqueadosComMatricula.length}`);
    log(`  destes, com progresso: ${bloqueadosComProgresso.length}`);
    log('');
    log(`SÓ NO LOGIN — entram e não veem nada: ${soNoLogin.length}`);

    if (LISTAR) {
      log('');
      log('só no banco (até 40):');
      for (const r of soNoBanco.slice(0, 40)) {
        console.log(`  ${r.email.padEnd(42)} ${r.matriculas} matrícula(s) · ${r.com_progresso} com progresso`);
      }
      log('só no login (até 20):');
      for (const u of soNoLogin.slice(0, 20)) {
        console.log(`  ${u.email.padEnd(42)} papel=${u.role}`);
      }
    }

    const total = new Set([...emailsLogin.keys(), ...emailsBanco.keys()]).size;
    log('');
    log(`pessoas distintas somando os dois lados: ${total}`);
    log(
      soNoBanco.length + soNoLogin.length === 0
        ? 'os dois lados estão alinhados'
        : `desalinhamento total: ${soNoBanco.length + soNoLogin.length} conta(s)`,
    );
  } finally {
    await client.end();
  }
}

void main();
