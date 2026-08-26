import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import {
  professionals as seedProfessionals,
  sessionServices as seedServices,
} from '../../src/app/data/seed';
import type { Professional, SessionService } from '../../src/app/types/schema';

/**
 * Análise, supervisão e orientação — serviços contratados à parte.
 *
 * A regra de preço é a que o dono definiu: **quem atende define quanto custa**,
 * não o serviço. A mesma sessão de análise custa um valor com profissional da
 * escola, outro com mestre, outro com doutor. Por isso o preço vive em
 * `session_price_tiers`, indexado pela titulação, e `sessionServices.price`
 * ficou como valor de referência do serviço quando não há faixa aplicável.
 *
 * Nada aqui pode virar requisito de curso — ver `server/sessions/regra-opcional.ts`.
 */

export interface PriceTier {
  id: string;
  label: string;
  description: string;
  priceCents: number;
  active: boolean;
  order: number;
}

/** Faixas iniciais, com os valores definidos pelo dono em 21/ago/2026. */
export const FAIXAS_PADRAO: PriceTier[] = [
  {
    id: 'escola',
    label: 'Profissional da escola',
    description: 'Psicanalistas formados pela PCO, em atuação supervisionada.',
    priceCents: 8000,
    active: true,
    order: 1,
  },
  {
    id: 'mestrado',
    label: 'Nível de mestre',
    description: 'Profissionais com mestrado concluído.',
    priceCents: 14000,
    active: true,
    order: 2,
  },
  {
    id: 'doutorado',
    label: 'Nível de doutorado',
    description: 'Profissionais com doutorado concluído.',
    priceCents: 45000,
    active: true,
    order: 3,
  },
];

const profStore = new JsonStore<Professional>('professionals.json', () =>
  seedProfessionals.map((p) => ({
    ...p,
    specialties: [...p.specialties],
    serviceIds: [...p.serviceIds],
  })),
);

const svcStore = new JsonStore<SessionService>('session-services.json', () =>
  seedServices.map((s) => ({ ...s })),
);

const tierStore = new JsonStore<PriceTier>('session-price-tiers.json', () =>
  FAIXAS_PADRAO.map((f) => ({ ...f })),
);

function novoId(prefixo: string): string {
  // randomUUID e não Date.now()+Math.random(): id de profissional e de serviço
  // aparece em URL de admin e em referência cruzada. Adivinhável é convite, e
  // criação em lote com o mesmo milissegundo colidia em 4 caracteres.
  return `${prefixo}-${randomUUID()}`;
}

// ---------- Faixas de preço ----------

export async function listPriceTiers(): Promise<PriceTier[]> {
  const db = getDb();
  if (!db) return (await tierStore.getAll()).sort((a, b) => a.order - b.order);
  const rows = await db.select().from(schema.sessionPriceTiers);
  // Tabela vazia é banco novo, não "sem faixas": devolver vazio faria toda
  // sessão aparecer sem preço na tela do aluno.
  if (rows.length === 0) return FAIXAS_PADRAO.map((f) => ({ ...f }));
  return rows
    .map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      priceCents: r.priceCents,
      active: r.active,
      order: r.order,
    }))
    .sort((a, b) => a.order - b.order);
}

export async function upsertPriceTier(input: PriceTier): Promise<PriceTier> {
  const db = getDb();
  if (db) {
    await db
      .insert(schema.sessionPriceTiers)
      .values(input)
      .onConflictDoUpdate({
        target: schema.sessionPriceTiers.id,
        set: {
          label: input.label,
          description: input.description,
          priceCents: input.priceCents,
          active: input.active,
          order: input.order,
        },
      });
    return input;
  }
  await tierStore.modify((rows) => {
    const i = rows.findIndex((r) => r.id === input.id);
    if (i >= 0) rows[i] = input;
    else rows.push(input);
  });
  return input;
}

/** Semeia as três faixas quando ainda não existem. Idempotente. */
export async function seedPriceTiers(): Promise<number> {
  const db = getDb();
  if (db) {
    const rows = await db.select().from(schema.sessionPriceTiers);
    if (rows.length > 0) return 0;
  } else if ((await tierStore.getAll()).length > 0) {
    return 0;
  }
  for (const f of FAIXAS_PADRAO) await upsertPriceTier({ ...f });
  return FAIXAS_PADRAO.length;
}

/**
 * A titulação informada corresponde a uma faixa **ativa**?
 *
 * Existe porque `level` é string livre no schema (`z.string().max(40)`) e não
 * enum: as faixas são editáveis pelo admin, então a lista válida é dado, não
 * tipo. Sem esta checagem, um `level` com typo entrava, não casava com faixa
 * nenhuma e o profissional ficava valendo R$ 0,00.
 */
export async function faixaValida(level: string): Promise<boolean> {
  const faixas = await listPriceTiers();
  return faixas.some((f) => f.id === level && f.active);
}

// ---------- Serviços ----------

/**
 * Catálogo de serviços.
 *
 * Com banco configurado e tabela vazia, cai na semente — o padrão da casa
 * (ver `repositories/courses.ts`). Mas repare na assimetria com
 * `listProfessionals`, logo abaixo, que devolve `[]` no mesmo caso: ali a
 * semente é gente fictícia e mostrá-la seria pior do que mostrar nada.
 *
 * O preço dessa assimetria: enquanto a tabela estiver vazia, esta lista devolve
 * ids que não existem no banco, e editar ou apagar um deles responde 404 —
 * porque `createSessionService` e as demais escritas vão direto para o banco.
 * `seedSessionServices()` existe para encerrar esse limbo: materializa a
 * semente no banco de uma vez, e a partir daí leitura e escrita concordam.
 */
export async function listSessionServices(): Promise<SessionService[]> {
  const db = getDb();
  if (!db) return await svcStore.getAll();
  const rows = await db.select().from(schema.sessionServices);
  if (rows.length === 0) return await svcStore.getAll();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as SessionService['type'],
    description: r.description,
    durationMinutes: r.durationMinutes,
    price: r.price,
    active: r.active,
    paymentBeforeConfirmation: r.paymentBeforeConfirmation,
  }));
}

/**
 * Grava a semente de serviços no banco quando a tabela está vazia. Idempotente:
 * com qualquer linha já existente, não faz nada. Espelha `seedPriceTiers`.
 */
export async function seedSessionServices(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const rows = await db.select().from(schema.sessionServices);
  if (rows.length > 0) return 0;
  const semente = await svcStore.getAll();
  if (semente.length === 0) return 0;
  await db.insert(schema.sessionServices).values(semente);
  return semente.length;
}

export async function createSessionService(
  input: Omit<SessionService, 'id'>,
): Promise<SessionService> {
  const row: SessionService = { ...input, id: novoId('svc') };
  const db = getDb();
  if (db) {
    await db.insert(schema.sessionServices).values(row);
    return row;
  }
  await svcStore.modify((rows) => {
    rows.push(row);
  });
  return row;
}

export async function updateSessionService(
  id: string,
  patch: Partial<Omit<SessionService, 'id'>>,
): Promise<SessionService | null> {
  const db = getDb();
  if (db) {
    const rows = await db
      .update(schema.sessionServices)
      .set(patch)
      .where(eq(schema.sessionServices.id, id))
      .returning();
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      type: r.type as SessionService['type'],
      description: r.description,
      durationMinutes: r.durationMinutes,
      price: r.price,
      active: r.active,
      paymentBeforeConfirmation: r.paymentBeforeConfirmation,
    };
  }
  let out: SessionService | null = null;
  await svcStore.modify((rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    rows[i] = { ...rows[i], ...patch };
    out = rows[i];
  });
  return out;
}

export async function deleteSessionService(id: string): Promise<boolean> {
  const db = getDb();
  if (db) {
    const rows = await db
      .delete(schema.sessionServices)
      .where(eq(schema.sessionServices.id, id))
      .returning();
    return rows.length > 0;
  }
  let ok = false;
  await svcStore.modify((rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    rows.splice(i, 1);
    ok = true;
  });
  return ok;
}

// ---------- Profissionais ----------

/** O que a tela precisa saber além do que o tipo antigo já dava. */
export interface ProfessionalRow extends Professional {
  level: string;
  active: boolean;
  available: boolean;
  credentials: string;
  /** Preço da sessão com este profissional, em centavos. Vem da faixa. */
  priceCents: number;
  /**
   * `true` quando nenhuma faixa ativa corresponde ao `level`. Nesse caso
   * `priceCents` vale 0 por falta de resposta, não por gratuidade — agendar
   * com este profissional deve ser recusado até o admin arrumar a faixa.
   */
  precoIndefinido: boolean;
}

/**
 * Aplica o preço da faixa de titulação.
 *
 * Duas coisas que este trecho já errou e agora não erra mais:
 *
 * - **Faixa inativa não precifica.** Antes, desmarcar `active` no admin não
 *   fazia nada: a faixa continuava sendo encontrada e cobrando.
 * - **Sem faixa não é de graça.** Antes o preço caía para 0 em silêncio, e
 *   `0` é um valor perfeitamente válido para um checkout — sessão grátis sem
 *   ninguém decidir isso. Agora o profissional sai marcado com
 *   `precoIndefinido`, e quem for cobrar recusa em vez de cobrar zero.
 */
function comPreco(
  p: Omit<ProfessionalRow, 'priceCents' | 'precoIndefinido'>,
  faixas: PriceTier[],
): ProfessionalRow {
  const faixa = faixas.find((f) => f.id === p.level && f.active);
  return {
    ...p,
    priceCents: faixa?.priceCents ?? 0,
    precoIndefinido: faixa === undefined,
  };
}

export async function listProfessionals(): Promise<ProfessionalRow[]> {
  const faixas = await listPriceTiers();
  const db = getDb();
  if (!db) {
    const rows = await profStore.getAll();
    return rows.map((r) => {
      const extra = r as Partial<ProfessionalRow>;
      return comPreco(
        {
          ...r,
          level: extra.level ?? 'escola',
          active: extra.active ?? true,
          available: extra.available ?? true,
          credentials: extra.credentials ?? '',
        },
        faixas,
      );
    });
  }
  const rows = await db.select().from(schema.professionals);
  if (rows.length === 0) return [];
  return rows.map((r) =>
    comPreco(
      {
        id: r.id,
        name: r.name,
        avatarColor: r.avatarColor,
        bio: r.bio,
        email: r.email,
        hourlyRate: r.hourlyRate,
        specialties: r.specialties ?? [],
        serviceIds: r.serviceIds ?? [],
        level: r.level,
        active: r.active,
        available: r.available,
        credentials: r.credentials,
      },
      faixas,
    ),
  );
}

/**
 * Quem pode atender agora. É o que a tela do aluno mostra: ele agenda com o
 * profissional disponível no momento, não escolhe uma pessoa e espera.
 *
 * Falha fechada, de propósito. Lista vazia de serviços **não** é curinga —
 * era, e o efeito era o oposto do esperado: como o formulário do admin cria
 * todo profissional com `serviceIds: []`, cada cadastro novo passava a ser
 * oferecido para análise, supervisão e orientação ao mesmo tempo. Melhor não
 * aparecer e o admin perceber do que aparecer onde não devia. Pelo mesmo
 * motivo, quem está sem faixa de preço válida também não é oferecido.
 */
export async function listAvailableProfessionals(serviceId?: string): Promise<ProfessionalRow[]> {
  const todos = await listProfessionals();
  return todos.filter(
    (p) =>
      p.active &&
      p.available &&
      !p.precoIndefinido &&
      p.serviceIds.length > 0 &&
      (!serviceId || p.serviceIds.includes(serviceId)),
  );
}

type NovoProfissional = Omit<ProfessionalRow, 'id' | 'priceCents' | 'precoIndefinido'>;

export async function createProfessional(input: NovoProfissional): Promise<ProfessionalRow> {
  const faixas = await listPriceTiers();
  const row = { ...input, id: novoId('prof') };
  const db = getDb();
  if (db) {
    await db.insert(schema.professionals).values(row);
  } else {
    await profStore.modify((rows) => {
      rows.push(row as Professional);
    });
  }
  return comPreco(row, faixas);
}

export async function updateProfessional(
  id: string,
  patch: Partial<NovoProfissional>,
): Promise<ProfessionalRow | null> {
  const faixas = await listPriceTiers();
  const db = getDb();
  if (db) {
    const rows = await db
      .update(schema.professionals)
      .set(patch)
      .where(eq(schema.professionals.id, id))
      .returning();
    const r = rows[0];
    if (!r) return null;
    return comPreco(
      {
        id: r.id,
        name: r.name,
        avatarColor: r.avatarColor,
        bio: r.bio,
        email: r.email,
        hourlyRate: r.hourlyRate,
        specialties: r.specialties ?? [],
        serviceIds: r.serviceIds ?? [],
        level: r.level,
        active: r.active,
        available: r.available,
        credentials: r.credentials,
      },
      faixas,
    );
  }
  let out: ProfessionalRow | null = null;
  await profStore.modify((rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    const atualizado = { ...rows[i], ...patch } as Professional;
    rows[i] = atualizado;
    out = comPreco(atualizado as unknown as Omit<ProfessionalRow, 'priceCents'>, faixas);
  });
  return out;
}

export async function deleteProfessional(id: string): Promise<boolean> {
  const db = getDb();
  if (db) {
    const rows = await db
      .delete(schema.professionals)
      .where(eq(schema.professionals.id, id))
      .returning();
    return rows.length > 0;
  }
  let ok = false;
  await profStore.modify((rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    rows.splice(i, 1);
    ok = true;
  });
  return ok;
}
