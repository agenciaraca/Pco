/**
 * Entrada de cron das Conversões Offline — diz ao Google Ads quais cliques
 * (gclid) viraram venda paga. Roda todo dia, instalado por
 * `scripts/install_google_ads_cron.sh`.
 *
 * Uso manual:
 *   npx tsx scripts/run_google_ads_offline_conversions.ts
 *
 * A lógica de verdade mora em `server/marketing/google-ads-offline-conversions.ts`
 * — este arquivo só carrega o `.env` e chama.
 */
import 'dotenv/config';
import { runOfflineConversions } from '../server/marketing/google-ads-offline-conversions';

async function main() {
  const inicio = Date.now();
  try {
    const r = await runOfflineConversions();
    const s = ((Date.now() - inicio) / 1000).toFixed(1);
    console.warn(
      `[google-ads offline-conversions] OK em ${s}s — ${r.candidatos} candidatos com gclid, ` +
        `${r.enviados} enviados, ação ${r.conversionActionResourceName}`,
    );
  } catch (err) {
    console.error(
      '[google-ads offline-conversions] FALHOU:',
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 1;
  }
}

void main();
