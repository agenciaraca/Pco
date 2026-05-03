// Aplica migrações em uma database remota usando Neon HTTP.
// Uso: DATABASE_URL=... npm run db:migrate

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL ausente.');
    process.exit(1);
  }

  const sql = neon(url);
  const db = drizzle(sql);

  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, 'migrations');

  console.log('[migrate] aplicando migrações...');
  await migrate(db, { migrationsFolder });
  console.log('[migrate] OK.');
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
