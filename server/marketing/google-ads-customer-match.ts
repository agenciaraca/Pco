/**
 * Customer Match — sobe a lista de clientes pagantes da PCO como público-alvo
 * no Google Ads (Gerenciador de Públicos). Roda 1x por mês, dia 1 (ver o cron
 * em `scripts/run-google-ads-customer-match.ts` e o comentário no topo de
 * `google-ads-config.ts` sobre a diferença entre isto e conversões offline).
 *
 * Espelha `scripts/export-customer-match.ts` da Academia Enlevo — mesma
 * lógica de "quem é pagante de verdade" — mas fala direto com a
 * `OfflineUserDataJobService` em vez de gerar CSV pra upload manual: aqui o
 * dado que sai do servidor já é hash, nunca o e-mail em claro.
 */

import { gt } from 'drizzle-orm';
import { getDb, hasDb, schema } from '../db/client';
import {
  buildContext,
  adsPost,
  adsPostAbsolute,
  gaqlSearch,
  hashEmail,
  hashName,
  GoogleAdsError,
} from './google-ads-client';
import { getConfig, patchConfig } from './google-ads-config';

const BATCH_SIZE = 1000; // limite prático por AddOfflineUserDataJobOperations request

/*
  O nome do tipo continua "ClienteCompleto" pela contagem que o admin lê na
  tela ("X de Y clientes completos") — mas "completo" é sobre TER pedido pago
  e e-mail, não sobre ter nome e sobrenome. A versão anterior deste arquivo
  exigia firstName+lastName pra a pessoa entrar na lista, e quem tinha só
  "Maria" no cadastro (nome de uma palavra) sumia da remarketing por inteiro —
  mesmo com e-mail hasheado, que sozinho já é um identificador válido pro
  Customer Match. Nome e sobrenome continuam OPCIONAIS aqui; quem chama decide
  o que fazer com a ausência.
*/
export interface ClienteCompleto {
  email: string;
  firstName?: string;
  lastName?: string;
  zip: string;
}

/**
 * Monta o registro de um cliente a partir do que o pedido e o cadastro dele
 * garantem. Pura e exportada de propósito — é o pedaço que decide quem entra
 * na lista, e é ele que o teste de regressão exercita sem precisar de banco.
 *
 * `null` quando não há e-mail válido: aí não há identificador nenhum, e o
 * pedido não entra na lista de jeito nenhum.
 */
export function construirCliente(input: {
  userEmail: string | null | undefined;
  cadastroEmail: string | null | undefined;
  nome: string | null | undefined;
  cep: string | null | undefined;
}): ClienteCompleto | null {
  const email = (input.cadastroEmail || input.userEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;

  const nome = (input.nome || '').trim();
  const parts = nome ? nome.split(/\s+/) : [];
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  const zip = (input.cep || '').replace(/\D/g, '');

  return { email, firstName, lastName, zip };
}

async function buscarClientesCompletos(): Promise<{
  scanned: number;
  complete: ClienteCompleto[];
}> {
  const db = getDb();
  if (!db) throw new Error('Banco não configurado — Customer Match precisa do DATABASE_URL.');

  // Todo pedido com paidAt preenchido é venda de verdade (mesma regra usada
  // no resto do admin de vendas) — status textual varia por gateway, paidAt não.
  const orders = await db
    .select({
      userEmail: schema.paymentOrders.userEmail,
      userId: schema.paymentOrders.userId,
      paidAt: schema.paymentOrders.paidAt,
    })
    .from(schema.paymentOrders)
    .where(gt(schema.paymentOrders.paidAt, ''));

  const userIds = Array.from(new Set(orders.map((o) => o.userId)));
  if (userIds.length === 0) return { scanned: orders.length, complete: [] };

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      address: schema.users.address,
    })
    .from(schema.users);
  const byId = new Map(users.map((u) => [u.id, u]));

  const map = new Map<string, ClienteCompleto>();
  for (const o of orders) {
    const u = byId.get(o.userId);
    const cliente = construirCliente({
      userEmail: o.userEmail,
      cadastroEmail: u?.email,
      nome: u?.name,
      cep: (u?.address as { cep?: string } | null)?.cep,
    });
    if (!cliente) continue;
    if (!map.has(cliente.email)) map.set(cliente.email, cliente);
  }

  return { scanned: orders.length, complete: Array.from(map.values()) };
}

/** Acha (e guarda) a lista de Customer Match já existente com esse nome, ou cria uma nova. */
async function resolverUserList(ctx: Awaited<ReturnType<typeof buildContext>>): Promise<string> {
  const cfg = await getConfig();
  if (cfg?.customerMatchUserListResourceName) return cfg.customerMatchUserListResourceName;

  const NOME = 'PCO — Clientes pagantes (Customer Match)';
  const existentes = await gaqlSearch(
    ctx,
    `SELECT user_list.id, user_list.resource_name FROM user_list WHERE user_list.name = '${NOME}'`,
  );
  if (existentes.length > 0) {
    const rn = (existentes[0] as { userList?: { resourceName?: string } }).userList?.resourceName;
    if (rn) {
      await patchConfig({ customerMatchUserListResourceName: rn });
      return rn;
    }
  }

  const created = await adsPost(ctx, '/userLists:mutate', {
    operations: [
      {
        create: {
          name: NOME,
          description: 'Gerado automaticamente pelo AVA a partir dos pedidos pagos.',
          membershipLifeSpan: 10000, // "sempre" (o Google limita a 10000 dias pra CRM-based)
          crmBasedUserList: { uploadKeyType: 'CONTACT_INFO', dataSourceType: 'FIRST_PARTY' },
        },
      },
    ],
  });
  const rn = (created as { results?: Array<{ resourceName?: string }> }).results?.[0]?.resourceName;
  if (!rn)
    throw new GoogleAdsError('O Google não devolveu o resourceName da lista criada.', 500, created);
  await patchConfig({ customerMatchUserListResourceName: rn });
  return rn;
}

export interface CustomerMatchResult {
  scanned: number;
  complete: number;
  uploaded: number;
  userListResourceName: string;
}

export async function runCustomerMatch(): Promise<CustomerMatchResult> {
  if (!hasDb()) throw new Error('Banco não configurado.');
  const ctx = await buildContext();
  const { scanned, complete } = await buscarClientesCompletos();
  const userListResourceName = await resolverUserList(ctx);

  const operations = complete.map((c) => ({
    create: {
      userIdentifiers: [
        { hashedEmail: hashEmail(c.email) },
        // O bloco de endereço exige os TRÊS — nome, sobrenome e CEP. Antes a
        // condição olhava só o CEP; um cliente com CEP e nome de uma palavra
        // só mandava um `hashedLastName` vazio, que o Google recusa (é campo
        // obrigatório dentro de `addressInfo`, não um opcional que se omite).
        ...(c.zip && c.firstName && c.lastName
          ? [
              {
                addressInfo: {
                  hashedFirstName: hashName(c.firstName),
                  hashedLastName: hashName(c.lastName),
                  postalCode: c.zip,
                  countryCode: 'BR',
                },
              },
            ]
          : []),
      ],
    },
  }));

  let uploaded = 0;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = operations.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;

    const job = await adsPost(ctx, '/offlineUserDataJobs:create', {
      job: {
        type: 'CUSTOMER_MATCH_USER_LIST',
        customerMatchUserListMetadata: { userList: userListResourceName },
      },
    });
    const jobResourceName = (job as { resourceName?: string }).resourceName;
    if (!jobResourceName) throw new GoogleAdsError('Falha ao criar o job de upload.', 500, job);

    await adsPostAbsolute(ctx, `${jobResourceName}:addOperations`, { operations: batch });
    await adsPostAbsolute(ctx, `${jobResourceName}:run`, {});
    uploaded += batch.length;
  }

  await patchConfig({
    lastCustomerMatchAt: new Date().toISOString(),
    lastCustomerMatchCount: uploaded,
  });

  return { scanned, complete: complete.length, uploaded, userListResourceName };
}
