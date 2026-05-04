// Email broadcasts — campanhas em massa para audiências segmentadas.
// Não retém o conteúdo — só metadata + estatísticas. Os e-mails entram no log normal.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import * as usersStore from '../auth/users-store';
import * as studentsRepo from '../repositories/students';
import * as notificationPrefs from './prefs-store';
import { sendSafe } from './sender';
import { signToken } from '../auth/jwt';

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
  const allRecipients = await resolveAudience(input.audience, {
    courseId: input.courseId,
    inactivityDays: input.inactivityDays,
  });
  // Honra preferências: remove quem optou por não receber broadcasts
  const blocked = await notificationPrefs.blockedFromBroadcasts();
  const recipients = allRecipients.filter((r) => !blocked.has(r.id));

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
  recipients: Array<{ id: string; email: string; name?: string }>,
  input: SendBroadcastInput,
): Promise<void> {
  await store.update(
    (b) => b.id === id,
    (b) => ({ ...b, status: 'running', startedAt: new Date().toISOString() }),
  );
  let sent = 0;
  let failed = 0;
  const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
  for (const r of recipients) {
    // Token de unsubscribe — TTL longo (1 ano), scope=unsubscribe
    const unsubToken = await signToken(
      {
        sub: r.id,
        email: r.email,
        role: 'student',
        tv: 0,
        scope: 'unsubscribe',
      },
      365 * 24 * 60 * 60,
    );
    const unsubUrl = `${base}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
    const footer = `\n<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">\n<p style="font-size:11px;color:#999;text-align:center;margin:8px 0;">\nVocê recebeu este e-mail porque é cadastrado no AVA PCO.\n<a href="${unsubUrl}" style="color:#0070f3;">Cancelar inscrição em comunicados</a>\n(e-mails essenciais como reset de senha continuam).\n</p>`;
    const html = input.html + footer;
    const result = await sendSafe({
      to: { email: r.email, name: r.name },
      subject: input.subject,
      html,
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
