// Sessões ao vivo agendadas (Zoom, Meet, ou qualquer URL).
// Modelo simples — não embute o player; só mantém metadata + link.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'canceled';

export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  courseId?: string | null;
  hostName?: string;
  joinUrl: string;
  startAt: string; // ISO
  durationMinutes: number;
  status: LiveSessionStatus;
  // Audiência: 'all' (qualquer aluno autenticado) ou 'enrolled' (matriculados no courseId)
  audience: 'all' | 'enrolled';
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<LiveSession>('live-sessions.json', () => []);

function newId(): string {
  return `lv-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<LiveSession[]> {
  const all = await store.getAll();
  return [...all].sort((a, b) => (a.startAt > b.startAt ? -1 : 1));
}

export async function listUpcoming(limit = 50): Promise<LiveSession[]> {
  const now = Date.now();
  const all = await store.getAll();
  return all
    .filter((s) => s.status !== 'canceled' && new Date(s.startAt).getTime() + s.durationMinutes * 60_000 > now - 60_000)
    .sort((a, b) => (a.startAt > b.startAt ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}

export async function findById(id: string): Promise<LiveSession | null> {
  return await store.findOne((s) => s.id === id);
}

export interface CreateInput {
  title: string;
  description?: string;
  courseId?: string | null;
  hostName?: string;
  joinUrl: string;
  startAt: string;
  durationMinutes: number;
  audience: 'all' | 'enrolled';
}

export async function createSession(input: CreateInput): Promise<LiveSession> {
  const now = new Date().toISOString();
  const s: LiveSession = {
    id: newId(),
    title: input.title,
    description: input.description,
    courseId: input.courseId ?? null,
    hostName: input.hostName,
    joinUrl: input.joinUrl,
    startAt: input.startAt,
    durationMinutes: input.durationMinutes,
    status: 'scheduled',
    audience: input.audience,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(s);
  return s;
}

export async function updateSession(
  id: string,
  patch: Partial<CreateInput> & { status?: LiveSessionStatus },
): Promise<LiveSession | null> {
  return await store.update(
    (s) => s.id === id,
    (s) => ({
      ...s,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.courseId !== undefined ? { courseId: patch.courseId } : {}),
      ...(patch.hostName !== undefined ? { hostName: patch.hostName } : {}),
      ...(patch.joinUrl !== undefined ? { joinUrl: patch.joinUrl } : {}),
      ...(patch.startAt !== undefined ? { startAt: patch.startAt } : {}),
      ...(patch.durationMinutes !== undefined
        ? { durationMinutes: patch.durationMinutes }
        : {}),
      ...(patch.audience !== undefined ? { audience: patch.audience } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function deleteSession(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((s) => s.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

/**
 * Computa status atual baseado em horário. Útil pra renderização.
 * Não persiste — chamada read-only.
 */
export function computeStatus(s: LiveSession): LiveSessionStatus {
  if (s.status === 'canceled' || s.status === 'ended') return s.status;
  const now = Date.now();
  const start = new Date(s.startAt).getTime();
  const end = start + s.durationMinutes * 60_000;
  if (now < start) return 'scheduled';
  if (now >= start && now < end) return 'live';
  return 'ended';
}
