// Seed automático: cria conexão pré-configurada para portalpco.com.br
// (origem WordPress + LearnDash) na primeira inicialização do servidor.
// Idempotente: só cria se não existir conexão com siteUrl matching.

import * as connections from '../connections-store';

const SEED = {
  name: 'portalpco.com.br (WP + LearnDash)',
  siteUrl: 'https://portalpco.com.br',
  wpUsername: 'novopco',
  wpAppPassword: 'winA OBFN mEBp tcqq OHBe loMh',
  // WC consumer key/secret podem ser adicionados depois pelo admin se for usar
  // a parte de produtos/pedidos WooCommerce. Por enquanto deixa em branco.
};

function normalizeUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
}

export async function seedPortalpcoConnection(): Promise<void> {
  try {
    const all = await connections.listConnections();
    const targetHost = normalizeUrl(SEED.siteUrl);
    const exists = all.some((c) => normalizeUrl(c.siteUrl) === targetHost);
    if (exists) {
      // eslint-disable-next-line no-console
      console.log('[seed] portalpco.com.br connection já existe — pulando.');
      return;
    }
    const created = await connections.createConnection({
      name: SEED.name,
      siteUrl: SEED.siteUrl,
      wpUsername: SEED.wpUsername,
      wpAppPassword: SEED.wpAppPassword,
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] portalpco.com.br connection criada (id=${created.id}).`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[seed] falha criando portalpco connection:', err);
  }
}
