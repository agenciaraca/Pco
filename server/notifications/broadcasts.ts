// Email broadcasts — campanhas em massa para audiências segmentadas.
// Não retém o conteúdo — só metadata + estatísticas. Os e-mails entram no log normal.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import * as usersStore from '../auth/users-store';
import * as studentsRepo from '../repositories/students';
import { sendSafe } from './sender';

export type BroadcastAudience =
  | 'all'
  | 'students_active'
  | 'students_inactive'
  | 'admins'
  | 'enrolled_in_course'
  | 'no_enrollment';

export type BroadcastStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Broadcast {
  id: string;
  subject: string;
  audience: BroadcastAudience;
  courseId?: string;
  inactivityDays?: number;
  status: BroadcastStatus;
  total: number;
  sent: number;
  failed: number;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

const store = new JsonStore<Broadcast>('email-broadcasts.json', () => []);

function newId(): string {
  return `bdc-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listBroadcasts(limit = 200): Promise<Broadcast[]> {
  const all = await store.getAll();
  return [...all]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, 1000)));
}

export interface SendBroadcastInput {
  subject: string;
  html: string;
  text?: string;
  audience: BroadcastAudience;
  courseId?: string;
  inactivityDays?: number;
  createdBy: string;
}

/**
 * Resolve audiência → lista de e-mails. Não envia ainda.
 */
export async function resolveAudience(
  audience: BroadcastAudience,
  opts: { courseId?: string; inactivityDays?: number } = {},
): Promise<Array<{ id: string; email: string; name?: string }>> {
  const users = await usersStore.listUsers();
  const inactivityCutoff = opts.inactivityDays
    ? Date.now() - opts.inactivityDays * 24 * 60 * 60_000
    : null;

  if (audience === 'all') {
    return users
      .filter((u) => u.active)
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }
  if (audience === 'admins') {
    return users
      .filter((u) => u.active && (u.role === 'admin' || u.role === 'superadmin'))
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }
  if (audience === 'students_active') {
    return users
      .filter((u) => u.active && u.role === 'student')
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }
  if (audience === 'students_inactive') {
    if (!inactivityCutoff) return [];
    const students = await studentsRepo.listAdminStudents({ limit: 5000 } as never);
    const inactiveIds = new Set(
      students
        .filter((s) => {
          const last = s.lastAccessAt ? new Date(s.lastAccessAt).getTime() : 0;
          return last < inactivityCutoff;
        })
        .map((s) => s.id),
    );
    return users
      .filter((u) => u.active && u.role === 'student' && inactiveIds.has(u.id))
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }
  if (audience === 'enrolled_in_course') {
    if (!opts.courseId) return [];
    const students = await studentsRepo.listAdminStudents({ limit: 5000 } as never);
    const enrolled = new Set(
      students
        .filter((s) => s.enrolledCourseIds?.includes(opts.courseId!))
        .map((s) => s.id),
    );
    return users
      .filter((u) => u.active && u.role === 'student' && enrolled.has(u.id))
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }
  if (audience === 'no_enrollment') {
    const students = await studentsRepo.listAdminStudents({ limit: 5000 } as never);
    const noEnrollIds = new Set(
      students.filter((s) => (s.enrolledCourseIds?.length ?? 0) === 0).map((s) => s.id),
    );
    return users
      .filter((u) => u.active && u.role === 'student' && noEnrollIds.has(u.id))
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }
  return [];
}

/**
 * Cria registro do broadcast e dispara em background. Não espera concluir.
 */
export async function startBroadcast(input: SendBroadcastInput): Promise<Broadcast> {
  const recipients = await resolveAudience(input.audience, {
    courseId: input.courseId,
    inactivityDays: input.inactivityDays,
  });

  const now = new Date().toISOString();
  const broadcast: Broadcast = {
    id: newId(),
    subject: input.subject,
    audience: input.audience,
    courseId: input.courseId,
    inactivityDays: input.inactivityDays,
    status: 'pending',
    total: recipients.length,
    sent: 0,
    failed: 0,
    createdBy: input.createdBy,
    createdAt: now,
  };
  await store.unshift(broadcast);

  // Dispara assíncrono — não bloqueia
  void runBroadcast(broadcast.id, recipients, input);

  return broadcast;
}

async function runBroadcast(
  id: string,
  recipients: Array<{ email: string; name?: string }>,
  input: SendBroadcastInput,
): Promise<void> {
  await store.update(
    (b) => b.id === id,
    (b) => ({ ...b, status: 'running', startedAt: new Date().toISOString() }),
  );
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendSafe({
      to: { email: r.email, name: r.name },
      subject: input.subject,
      html: input.html,
      text: input.text,
      tag: 'broadcast',
    });
    if (result.ok) sent++;
    else failed++;
    if ((sent + failed) % 25 === 0) {
      await store.update(
        (b) => b.id === id,
        (b) => ({ ...b, sent, failed }),
      );
    }
    // Pequena pausa para não estourar rate-limit do provider
    await new Promise((r) => setTimeout(r, 100));
  }
  await store.update(
    (b) => b.id === id,
    (b) => ({
      ...b,
      sent,
      failed,
      status: 'completed',
      finishedAt: new Date().toISOString(),
    }),
  );
}
