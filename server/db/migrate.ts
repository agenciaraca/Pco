// Aplica migrações em uma database remota usando node-postgres (TCP).
// Uso: DATABASE_URL=... npm run db:migrate

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL ausente.');
    process.exit(1);
  }

  const cleanUrl = url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '');
  const pool = new pg.Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, 'migrations');

  console.log('[migrate] aplicando migrações...');
  await migrate(db, { migrationsFolder });
  console.log('[migrate] OK.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
