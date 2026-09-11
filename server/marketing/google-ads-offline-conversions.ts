/**
 * Conversões offline — diz ao Google Ads QUAL clique (gclid) virou venda paga.
 * Roda todo dia (ver `scripts/run-google-ads-offline-conversions.ts`). Não
 * tem nada a ver com o Customer Match (ver o comentário no topo de
 * `google-ads-config.ts`) — aqui é atribuição de venda, lá é público-alvo.
 *
 * A PCO não tem um proxy tipo o `gaproxy` da Academia Enlevo (feed que o
 * Google busca sozinho); aqui o upload é direto pela
 * `ConversionUploadService.uploadClickConversions`, chamado por este
 * processo. Mais simples de operar com uma conta só.
 */

import { and, gt, isNotNull } from 'drizzle-orm';
import { getDb, hasDb, schema } from '../db/client';
import { buildContext, adsPost, gaqlSearch, GoogleAdsError } from './google-ads-client';
import { getConfig, patchConfig } from './google-ads-config';

/** Acha (e guarda) a ação de conversão "Venda PCO" — cria se não existir. */
async function resolverConversionAction(
  ctx: Awaited<ReturnType<typeof buildContext>>,
): Promise<string> {
  const cfg = await getConfig();
  if (cfg?.conversionActionResourceName) return cfg.conversionActionResourceName;

  const NOME = 'PCO — Venda (offline)';
  const existentes = await gaqlSearch(
    ctx,
    `SELECT conversion_action.id, conversion_action.resource_name FROM conversion_action WHERE conversion_action.name = '${NOME}'`,
  );
  if (existentes.length > 0) {
    const rn = (existentes[0] as { conversionAction?: { resourceName?: string } }).conversionAction
      ?.resourceName;
    if (rn) {
      await patchConfig({ conversionActionResourceName: rn });
      return rn;
    }
  }

  const created = await adsPost(ctx, '/conversionActions:mutate', {
    operations: [
      {
        create: {
          name: NOME,
          type: 'UPLOAD_CLICKS',
          category: 'PURCHASE',
          status: 'ENABLED',
          viewThroughLookbackWindowDays: 30,
          valueSettings: { defaultValue: 0, alwaysUseDefaultValue: false },
        },
      },
    ],
  });
  const rn = (created as { results?: Array<{ resourceName?: string }> }).results?.[0]?.resourceName;
  if (!rn)
    throw new GoogleAdsError('O Google não devolveu o resourceName da ação criada.', 500, created);
  await patchConfig({ conversionActionResourceName: rn });
  return rn;
}

export interface OfflineConversionsResult {
  candidatos: number;
  enviados: number;
  conversionActionResourceName: string;
}

/**
 * Janela de 90 dias: o Google só casa gclid dentro desse período contado do
 * clique (mesma regra documentada em `project_conversoes-offline-janela-clique`
 * do lado da Academia Enlevo). Rodar diário mantém a janela sempre coberta.
 */
export async function runOfflineConversions(): Promise<OfflineConversionsResult> {
  if (!hasDb()) throw new Error('Banco não configurado.');
  const db = getDb()!;
  const ctx = await buildContext();
  const conversionActionResourceName = await resolverConversionAction(ctx);

  const noventaDiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const orders = await db
    .select({
      id: schema.paymentOrders.id,
      paidAt: schema.paymentOrders.paidAt,
      amountCents: schema.paymentOrders.amountCents,
      currency: schema.paymentOrders.currency,
      attribution: schema.paymentOrders.attribution,
    })
    .from(schema.paymentOrders)
    .where(
      and(
        gt(schema.paymentOrders.paidAt, noventaDiasAtras),
        isNotNull(schema.paymentOrders.attribution),
      ),
    );

  const candidatos = orders.filter((o) => !!o.attribution?.gclid);

  const operations = candidatos.map((o) => ({
    gclid: o.attribution!.gclid,
    conversionAction: conversionActionResourceName,
    conversionDateTime: formatarDataConversao(o.paidAt!),
    conversionValue: o.amountCents / 100,
    currencyCode: o.currency || 'BRL',
    orderId: o.id,
  }));

  let enviados = 0;
  // 2000 é o teto documentado da API pra uploadClickConversions numa chamada só.
  for (let i = 0; i < operations.length; i += 2000) {
    const batch = operations.slice(i, i + 2000);
    if (batch.length === 0) continue;
    await adsPost(ctx, ':uploadClickConversions', {
      conversions: batch,
      partialFailure: true,
    });
    enviados += batch.length;
  }

  await patchConfig({
    lastOfflineConversionsAt: new Date().toISOString(),
    lastOfflineConversionsCount: enviados,
  });

  return { candidatos: candidatos.length, enviados, conversionActionResourceName };
}

/** O Google exige "AAAA-MM-DD HH:MM:SS+HH:MM". `paidAt` é ISO — só reformata. */
function formatarDataConversao(isoPaidAt: string): string {
  const d = new Date(isoPaidAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(off) / 60));
  const offM = pad(Math.abs(off) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sinal}${offH}:${offM}`
  );
}
