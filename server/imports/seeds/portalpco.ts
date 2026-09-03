// Seed automático: cria conexão pré-configurada para portalpco.online
// (origem WordPress + LearnDash) na primeira inicialização do servidor.
// Idempotente: só cria se não existir conexão equivalente. Considera tanto
// portalpco.online (correto) quanto portalpco.com.br (URL antiga, errada).

import * as connections from '../connections-store';

/**
 * A credencial vem do AMBIENTE, nunca do codigo.
 *
 * Ate 3/set/2026 a Application Password de administrador do WordPress de
 * `portalpco.online` estava aqui, em literal, num arquivo versionado — desde
 * 5/mai/2026 — e `server/dev.ts` executa este seed a cada boot. Isso da acesso
 * de leitura a base de usuarios do site de origem, e o repositorio e remoto.
 *
 * **Tirar daqui nao desfaz o que ja aconteceu.** O valor esta no historico do
 * git e continua recuperavel em todo clone, fork e runner de CI que ja baixou o
 * repositorio; quem resolve e a revogacao no painel do WordPress. Esta mudanca
 * garante o daqui para frente.
 *
 * Sem as variaveis definidas, o seed **nao cria conexao nenhuma** e diz por
 * que. Conexao de importacao aponta para site de producao com credencial de
 * admin: nascer de um default e a forma errada de existir.
 *
 * ## Os nomes sao os que o repositorio ja usa, e o arquivo importa
 *
 * `PORTAL_PCO_URL`, `PORTAL_PCO_USER` e `PORTAL_PCO_APP_PASSWORD` sao os mesmos
 * nomes que `scripts/migrate_wp_to_ava.ts` e `scripts/import_secondaries.ts`
 * exigem, e os que ja estao preenchidos no `.env.import` de quem desenvolve.
 * A primeira versao desta correcao inventou `IMPORT_PORTALPCO_*` — nome que
 * nada le — e mandava defini-lo em `.env.import`, que **o servidor nunca
 * carrega**: `server/dev.ts` faz `import 'dotenv/config'`, e isso le `.env`.
 * A instrucao era impossivel de cumprir, e o seed ficaria mudo para sempre.
 *
 * Quem le `.env.import` sao os **scripts**, cada um com `loadEnv({ path })`
 * explicito. Para o servidor enxergar, as variaveis tem de estar no `.env`
 * dele — e e uma decisao deliberada, nao um efeito colateral de ter rodado uma
 * importacao um dia.
 */
const SEED = {
  name: process.env.PORTAL_PCO_NAME ?? 'Portal PCO (LearnDash)',
  siteUrl: process.env.PORTAL_PCO_URL ?? '',
  wpUsername: process.env.PORTAL_PCO_USER ?? '',
  wpAppPassword: process.env.PORTAL_PCO_APP_PASSWORD ?? '',
};

/** Sem os tres, nao ha o que semear. */
function seedConfigurado(): boolean {
  return Boolean(SEED.siteUrl && SEED.wpUsername && SEED.wpAppPassword);
}

// Aliases — qualquer connection com um destes hosts e considerada equivalente
// e nao tenta recriar. Inclui o .com.br (URL antiga errada) pra evitar
// duplicacao em deploys que ainda tenham a conexao legada cadastrada.
const ALIASES = ['portalpco.online', 'portalpco.com.br'];

function normalizeUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
}

export async function seedPortalpcoConnection(): Promise<void> {
  if (!seedConfigurado()) {
    // eslint-disable-next-line no-console
    console.log(
      '[seed] conexão de import do portalpco não criada: defina ' +
        'PORTAL_PCO_URL, PORTAL_PCO_USER e PORTAL_PCO_APP_PASSWORD ' +
        'no .env do servidor (o .env.import é lido só pelos scripts) ' +
        '— ou cadastre a conexão em /admin/imports, que é o caminho normal.',
    );
    return;
  }
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
