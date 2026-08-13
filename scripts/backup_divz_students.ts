/**
 * Dump de segurança das tabelas que o `load_v3_to_divz.ts` apaga e reinsere.
 *
 * O loader faz wipe-and-reload de users(role=student) + students + enrollments
 * dentro de uma transação. Se a carga sair errada, o rollback do Postgres já
 * cobre a falha *durante* a transação — mas não cobre um commit bem-sucedido
 * com dados ruins. Este dump é a rede para esse caso.
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/backup_divz_students.ts
 *   DATABASE_URL=... npx tsx scripts/backup_divz_students.ts --out=caminho.json
 *
 * Escreve JSON com as três tabelas + contagens em `backups/` (gitignored).
 * DivZ usa cert self-signed → ssl.rejectUnauthorized=false.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

const outArg = process.argv.find((a) => a.startsWith('--out='));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = outArg
  ? outArg.slice('--out='.length)
  : path.resolve(process.cwd(), 'backups', `divz-students-${stamp}.json`);

const log = (m: string) => console.log(`[backup-divz] ${m}`);

// Mesma razão de server/db/client.ts: o pg-connection-string moderno trata
// `sslmode=require` como `verify-full`, que rejeita o cert self-signed do DivZ.
// Removemos os params e passamos o SSL explicitamente no objeto.
function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

async function main(): Promise<void> {
  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL as string),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  log('conectado');

  try {
    const [users, students, enrollments] = await Promise.all([
      client.query("SELECT * FROM users WHERE role = 'student'"),
      client.query('SELECT * FROM students'),
      client.query('SELECT * FROM enrollments'),
    ]);

    // Contagem de todos os users (inclusive admin) só para conferência posterior
    const total = await client.query('SELECT role, COUNT(*)::int AS n FROM users GROUP BY role');

    const dump = {
      takenAt: new Date().toISOString(),
      source: 'DivZ (produção)',
      counts: {
        studentUsers: users.rowCount,
        students: students.rowCount,
        enrollments: enrollments.rowCount,
        usersByRole: Object.fromEntries(
          total.rows.map((r: { role: string; n: number }) => [r.role, r.n]),
        ),
      },
      rows: {
        users: users.rows,
        students: students.rows,
        enrollments: enrollments.rows,
      },
    };

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(dump, null, 2), 'utf8');

    log(`users(student)=${users.rowCount} students=${students.rowCount} enrollments=${enrollments.rowCount}`);
    log(`por role: ${JSON.stringify(dump.counts.usersByRole)}`);
    log(`gravado em ${outPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[backup-divz] FALHOU:', err);
  process.exit(1);
});
