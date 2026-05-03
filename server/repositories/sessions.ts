import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import {
  professionals as seedProfessionals,
  sessionServices as seedServices,
} from '../../src/app/data/seed';
import type { Professional, SessionService } from '../../src/app/types/schema';

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

export async function listProfessionals(): Promise<Professional[]> {
  const db = getDb();
  if (!db) return await profStore.getAll();
  const rows = await db.select().from(schema.professionals);
  if (rows.length === 0) return await profStore.getAll();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarColor: r.avatarColor,
    bio: r.bio,
    email: r.email,
    hourlyRate: r.hourlyRate,
    specialties: r.specialties ?? [],
    serviceIds: r.serviceIds ?? [],
  }));
}

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
