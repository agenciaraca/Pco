import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';

/**
 * Agendamento de sessão — a parte que faltava para a tela do aluno deixar de
 * ser encenação.
 *
 * Três decisões que valem explicação:
 *
 * 1. **O preço é travado no ato.** O admin muda faixas de titulação quando
 *    quiser; o que foi combinado com o aluno não muda junto. Por isso
 *    `priceCents` é copiado aqui e não lido da faixa na hora de exibir.
 * 2. **Nome do serviço e de quem atende também são cópia.** Profissional que
 *    sai da escola continua nomeado no histórico de quem foi atendido por ele.
 * 3. **Agendar não é pagar.** O agendamento nasce `pending_payment` quando o
 *    serviço exige pagamento antes, e `scheduled` quando a confirmação é
 *    manual. Ligar o checkout é trocar o status — nada aqui precisa mudar.
 *
 * E a regra que atravessa tudo: sessão é serviço OPCIONAL, contratado à parte.
 * Nada neste arquivo pode virar requisito de curso —
 * ver `server/sessions/regra-opcional.ts`.
 */

export type BookingStatus = 'pending_payment' | 'confirmed' | 'scheduled' | 'done' | 'cancelled';

export const STATUS_VALIDOS: BookingStatus[] = [
  'pending_payment',
  'confirmed',
  'scheduled',
  'done',
  'cancelled',
];

/** Status em que o horário ainda está ocupado de fato. */
export const STATUS_ATIVOS: BookingStatus[] = ['pending_payment', 'confirmed', 'scheduled'];

export interface SessionBooking {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  /** Início da sessão, ISO-8601. */
  scheduledFor: string;
  durationMinutes: number;
  priceCents: number;
  tierId: string;
  status: BookingStatus;
  meetingLink: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string;
  /** Pedido que paga esta sessão, quando há pagamento antes da confirmação. */
  orderId: string | null;
}

const store = new JsonStore<SessionBooking>('session-bookings.json', () => []);

function agora(): string {
  return new Date().toISOString();
}

function daLinha(r: typeof schema.sessionBookings.$inferSelect): SessionBooking {
  return {
    id: r.id,
    userId: r.userId,
    userEmail: r.userEmail,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    professionalId: r.professionalId,
    professionalName: r.professionalName,
    scheduledFor: r.scheduledFor,
    durationMinutes: r.durationMinutes,
    priceCents: r.priceCents,
    tierId: r.tierId,
    status: r.status as BookingStatus,
    meetingLink: r.meetingLink,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    cancelledAt: r.cancelledAt ?? null,
    cancelReason: r.cancelReason,
    orderId: r.orderId ?? null,
  };
}

function porDataDesc(a: SessionBooking, b: SessionBooking): number {
  return b.scheduledFor.localeCompare(a.scheduledFor);
}

export type NovoAgendamento = Omit<
  SessionBooking,
  'id' | 'createdAt' | 'updatedAt' | 'cancelledAt' | 'cancelReason' | 'orderId'
>;

export async function create(input: NovoAgendamento): Promise<SessionBooking> {
  const ts = agora();
  const row: SessionBooking = {
    ...input,
    id: `bkg-${randomUUID()}`,
    createdAt: ts,
    updatedAt: ts,
    cancelledAt: null,
    cancelReason: '',
    orderId: null,
  };
  const db = getDb();
  if (db) {
    await db.insert(schema.sessionBookings).values(row);
    return row;
  }
  await store.modify((rows) => {
    rows.push(row);
  });
  return row;
}

export async function listAll(): Promise<SessionBooking[]> {
  const db = getDb();
  if (!db) return (await store.getAll()).sort(porDataDesc);
  const rows = await db.select().from(schema.sessionBookings);
  return rows.map(daLinha).sort(porDataDesc);
}

export async function listForUser(userId: string): Promise<SessionBooking[]> {
  return (await listAll()).filter((b) => b.userId === userId);
}

export async function findById(id: string): Promise<SessionBooking | null> {
  const db = getDb();
  if (!db) return (await store.getAll()).find((b) => b.id === id) ?? null;
  const rows = await db
    .select()
    .from(schema.sessionBookings)
    .where(eq(schema.sessionBookings.id, id));
  const r = rows[0];
  return r ? daLinha(r) : null;
}

/**
 * O mesmo profissional no mesmo horário, ainda de pé. Bloqueio simples e
 * suficiente enquanto não existe agenda com janelas: dois alunos não marcam o
 * mesmo início com a mesma pessoa.
 */
export async function horarioOcupado(
  professionalId: string,
  scheduledFor: string,
): Promise<boolean> {
  const todos = await listAll();
  return todos.some(
    (b) =>
      b.professionalId === professionalId &&
      b.scheduledFor === scheduledFor &&
      STATUS_ATIVOS.includes(b.status),
  );
}

/** O agendamento que um pedido paga. Usado quando o gateway confirma. */
export async function findByOrderId(orderId: string): Promise<SessionBooking | null> {
  return (await listAll()).find((b) => b.orderId === orderId) ?? null;
}

export async function update(
  id: string,
  patch: Partial<Omit<SessionBooking, 'id' | 'createdAt'>>,
): Promise<SessionBooking | null> {
  const dados = { ...patch, updatedAt: agora() };
  const db = getDb();
  if (db) {
    const rows = await db
      .update(schema.sessionBookings)
      .set(dados)
      .where(eq(schema.sessionBookings.id, id))
      .returning();
    const r = rows[0];
    return r ? daLinha(r) : null;
  }
  let out: SessionBooking | null = null;
  await store.modify((rows) => {
    const i = rows.findIndex((b) => b.id === id);
    if (i < 0) return;
    rows[i] = { ...rows[i], ...dados };
    out = rows[i];
  });
  return out;
}

/**
 * Cancelar não apaga: vira `cancelled` com data e motivo. Histórico de quem
 * atendeu quem é registro, não rascunho.
 */
export async function cancel(id: string, reason: string): Promise<SessionBooking | null> {
  const ts = agora();
  return update(id, {
    status: 'cancelled',
    cancelledAt: ts,
    cancelReason: reason.slice(0, 400),
  });
}

/** Só para os testes: esvazia o store em memória. */
export async function _resetParaTeste(): Promise<void> {
  await store.setAll([]);
}
