import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface MentoringConfig {
  id: string;
  courseId: string;
  instructorName: string;
  bookingUrl: string;
  provider: 'calendly' | 'calcom' | 'other';
  description?: string;
  durationMinutes?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<MentoringConfig>('mentoring-configs.json', () => []);

function newId(): string {
  return `mnt-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<MentoringConfig[]> {
  return await store.getAll();
}

export async function listByCourse(courseId: string): Promise<MentoringConfig[]> {
  return await store.filter((m) => m.courseId === courseId && m.active);
}

export async function findById(id: string): Promise<MentoringConfig | null> {
  return await store.findOne((m) => m.id === id);
}

export interface CreateInput {
  courseId: string;
  instructorName: string;
  bookingUrl: string;
  provider: 'calendly' | 'calcom' | 'other';
  description?: string;
  durationMinutes?: number;
}

export async function create(input: CreateInput): Promise<MentoringConfig> {
  const now = new Date().toISOString();
  const cfg: MentoringConfig = {
    id: newId(),
    courseId: input.courseId,
    instructorName: input.instructorName,
    bookingUrl: input.bookingUrl,
    provider: input.provider,
    description: input.description,
    durationMinutes: input.durationMinutes,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(cfg);
  return cfg;
}

export async function update(
  id: string,
  patch: Partial<CreateInput> & { active?: boolean },
): Promise<MentoringConfig | null> {
  return await store.update(
    (m) => m.id === id,
    (m) => ({
      ...m,
      ...(patch.instructorName !== undefined ? { instructorName: patch.instructorName } : {}),
      ...(patch.bookingUrl !== undefined ? { bookingUrl: patch.bookingUrl } : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.durationMinutes !== undefined ? { durationMinutes: patch.durationMinutes } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function remove(id: string): Promise<boolean> {
  // `remove` faz isto numa passada sobre a lista viva. Era `getAll` + `filter`
  // + `setAll`, e esse par instala uma cópia por cima do estado: tudo que
  // outra chamada inserir entre as duas some sem erro.
  return await store.remove((m) => m.id === id);
}

export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}
