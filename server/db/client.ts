// Cliente Drizzle env-gated.
//
// - Se DATABASE_URL não está definido, db === null (caller faz fallback no seed).
// - Se está definido, usa @neondatabase/serverless (HTTP), que funciona
//   em Vercel Functions (Node), edge e Bun sem mudar nada.
//
// Em runtime serverless o pool é por invocação — Neon cuida de manter conexão.

import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;
let _initialized = false;

export function getDb(): DB | null {
  if (_initialized) return _db;
  _initialized = true;

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(
        '[db] DATABASE_URL não definido — repositórios usam fallback in-memory (seed).',
      );
    }
    return null;
  }

  try {
    const sql = neon(url);
    _db = drizzle(sql, { schema });
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[db] conectado ao Postgres via Neon HTTP');
    }
    return _db;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] falha ao conectar — usando fallback', err);
    _db = null;
    return null;
  }
}

export function hasDb(): boolean {
  return getDb() !== null;
}

export { schema };
