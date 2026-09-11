/**
 * Entrada de cron do Customer Match — sobe a lista de clientes pagantes como
 * público-alvo no Google Ads. Roda 1x por mês (dia 1), instalado por
 * `scripts/install_google_ads_cron.sh`.
 *
 * Uso manual:
 *   npx tsx scripts/run_google_ads_customer_match.ts
 *
 * A lógica de verdade mora em `server/marketing/google-ads-customer-match.ts`
 * — este arquivo só carrega o `.env` e chama.
 */
import 'dotenv/config';
import { runCustomerMatch } from '../server/marketing/google-ads-customer-match';

async function main() {
  const inicio = Date.now();
  try {
    const r = await runCustomerMatch();
    const s = ((Date.now() - inicio) / 1000).toFixed(1);
    console.warn(
      `[google-ads customer-match] OK em ${s}s — ${r.scanned} pedidos pagos, ` +
        `${r.complete} clientes completos, ${r.uploaded} enviados, lista ${r.userListResourceName}`,
    );
  } catch (err) {
    console.error('[google-ads customer-match] FALHOU:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

void main();
