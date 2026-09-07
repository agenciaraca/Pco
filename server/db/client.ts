// Cliente Drizzle env-gated.
//
// - Se DATABASE_URL não está definido, db === null (caller faz fallback no seed).
// - Se está definido, usa node-postgres (pg) via TCP, compatível com qualquer
//   Postgres padrão (DivZ, RDS, VPS self-hosted, Neon via pooler TCP, etc.).
//
// Nota de deploy: o Pool mantém conexões TCP vivas — ideal para o processo
// long-lived do VPS. Em Vercel Functions o pool é por invocação; o `max` baixo
// evita esgotar o limite de conexões do servidor.

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { instalarRetry } from './repetir-consulta';

export type DB = NodePgDatabase<typeof schema>;

let _db: DB | null = null;
let _initialized = false;

// Remove params de SSL da connection string. O pg-connection-string moderno
// trata `sslmode=require` como `verify-full`, o que rejeita certificados
// self-signed (o caso do DivZ). Passamos o SSL explicitamente via objeto.
function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

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
    const pool = new pg.Pool({
      connectionString: stripSslParams(url),
      // rejectUnauthorized:false aceita cert self-signed (DivZ). A conexão
      // continua criptografada; apenas não valida a cadeia da CA.
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      /*
        Keepalive de TCP, porque o banco é REMOTO.

        Sem ele, uma conexão parada é derrubada em silêncio por NAT ou firewall
        no meio do caminho, e a próxima consulta que a usar morre com
        `Connection terminated unexpectedly` ou `read ETIMEDOUT` — as duas
        mensagens que aparecem no log de produção. O pacote de keepalive mantém
        o caminho vivo; é barato e não muda comportamento nenhum.
      */
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    // Log de erros do pool para não derrubar o processo em desconexões.
    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[db] erro idle no pool pg:', err.message);
    });
    /*
      Retentativa para queda de conexão. Ver `db/repetir-consulta.ts` — leitura
      repete sempre, escrita só quando é certo que a consulta não saiu. Em
      7/set/2026 o log de produção tinha 10 chamados de aluno perdidos, 21
      leituras do site público falhando e um certificado não emitido, todos por
      queda de conexão, e nenhum tinha retentativa.
    */
    _db = drizzle(instalarRetry(pool), { schema });
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[db] conectado ao Postgres via node-postgres (pg)');
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
