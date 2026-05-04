// Worker de reengajamento — uma vez por dia (ou tick manual) varre alunos inativos
// e envia e-mail via módulo de notifications/sender.

import * as configStore from './config-store';
import * as studentsRepo from '../repositories/students';
import * as usersStore from '../auth/users-store';
import { sendSafe } from '../notifications/sender';

export interface RunResult {
  scanned: number;
  inactive: number;
  sent: number;
  skipped: number;
  errors: number;
  details?: string[];
}

export async function tickWorker(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const cfg = await configStore.getConfig();
  if (!cfg.enabled && !opts.dryRun) {
    return { scanned: 0, inactive: 0, sent: 0, skipped: 0, errors: 0 };
  }
  const students = await studentsRepo.listAdminStudents({ limit: 5000 } as never);
  const now = Date.now();
  const inactivityMs = cfg.inactivityDays * 24 * 60 * 60_000;
  const cooldownMs = cfg.cooldownDays * 24 * 60 * 60_000;

  let scanned = 0;
  let inactive = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const details: string[] = [];

  for (const s of students) {
    scanned++;
    if (!s.lastAccessAt) continue;
    const last = new Date(s.lastAccessAt).getTime();
    if (now - last < inactivityMs) continue;
    if (cfg.onlyEnrolled && (s.enrolledCourseIds?.length ?? 0) === 0) continue;
    inactive++;

    // Cooldown
    const lastSent = await configStore.lastSentForUser(s.id);
    if (lastSent && now - new Date(lastSent).getTime() < cooldownMs) {
      skipped++;
      continue;
    }

    const user = await usersStore.findUserById(s.id);
    if (!user || !user.email) {
      skipped++;
      continue;
    }

    const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
    const html = renderTemplate(cfg.bodyHtml, {
      name: user.name,
      lastAccess: new Date(s.lastAccessAt).toLocaleDateString('pt-BR'),
      loginUrl: `${base}/login`,
    });
    const subject = renderTemplate(cfg.subject, {
      name: user.name,
      lastAccess: new Date(s.lastAccessAt).toLocaleDateString('pt-BR'),
      loginUrl: `${base}/login`,
    });

    if (opts.dryRun) {
      details.push(`would send to ${user.email}`);
      continue;
    }

    const r = await sendSafe({
      to: { email: user.email, name: user.name },
      subject,
      html,
      tag: 'reengagement',
    });
    if (r.ok) {
      await configStore.recordSent(s.id, user.email);
      sent++;
    } else {
      errors++;
      details.push(`error ${user.email}: ${r.error}`);
    }
  }

  return { scanned, inactive, sent, skipped, errors, details };
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

let interval: NodeJS.Timeout | null = null;

/** Loop diário. Se intervalMs omitido, usa 24h. */
export function startWorker(intervalMs = 24 * 60 * 60_000): void {
  if (interval) return;
  interval = setInterval(() => {
    void tickWorker().catch(() => {
      /* swallow */
    });
  }, intervalMs);
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
