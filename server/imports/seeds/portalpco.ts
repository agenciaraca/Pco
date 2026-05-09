// Seed automático: cria conexão pré-configurada para portalpco.online
// (origem WordPress + LearnDash) na primeira inicialização do servidor.
// Idempotente: só cria se não existir conexão equivalente. Considera tanto
// portalpco.online (correto) quanto portalpco.com.br (URL antiga, errada).

import * as connections from '../connections-store';

const SEED = {
  name: 'portalpco.online (WP + LearnDash)',
  siteUrl: 'https://portalpco.online',
  wpUsername: 'novopco',
  wpAppPassword: 'winA OBFN mEBp tcqq OHBe loMh',
};

// Aliases — qualquer connection com um destes hosts e considerada equivalente
// e nao tenta recriar. Inclui o .com.br (URL antiga errada) pra evitar
// duplicacao em deploys que ainda tenham a conexao legada cadastrada.
const ALIASES = ['portalpco.online', 'portalpco.com.br'];

function normalizeUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
}

export async function seedPortalpcoConnection(): Promise<void> {
  try {
    const all = await connections.listConnections();
    const exists = all.some((c) => {
      const h = normalizeUrl(c.siteUrl);
      return ALIASES.some((a) => h === a);
    });
    if (exists) {
      // eslint-disable-next-line no-console
      console.log('[seed] portalpco connection já existe — pulando.');
      return;
    }
    const created = await connections.createConnection({
      name: SEED.name,
      siteUrl: SEED.siteUrl,
      wpUsername: SEED.wpUsername,
      wpAppPassword: SEED.wpAppPassword,
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] portalpco.online connection criada (id=${created.id}).`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[seed] falha criando portalpco connection:', err);
  }
}
