import { JsonStore } from '../db/json-store';
import * as studentsRepo from '../repositories/students';
import * as progressRepo from '../repositories/progress';
import * as coursesRepo from '../repositories/courses';
import * as usersStore from '../auth/users-store';
import { blockedFromReengagement } from './prefs-store';
import { sendSafe } from './sender';

export interface StudentProgressConfig {
  enabled: boolean;
  dayOfWeekUtc: number;
  hourUtc: number;
}

const DEFAULT_CFG: StudentProgressConfig = {
  enabled: false,
  dayOfWeekUtc: 0, // domingo
  hourUtc: 10,
};

const cfgStore = new JsonStore<StudentProgressConfig>(
  'student-progress-email-config.json',
  () => [DEFAULT_CFG],
);

export async function getConfig(): Promise<StudentProgressConfig> {
  const all = await cfgStore.getAll();
  return all[0] ?? DEFAULT_CFG;
}

export async function setConfig(
  patch: Partial<StudentProgressConfig>,
): Promise<StudentProgressConfig> {
  const cur = await getConfig();
  const next: StudentProgressConfig = { ...cur, ...patch };
  if (next.hourUtc < 0) next.hourUtc = 0;
  if (next.hourUtc > 23) next.hourUtc = 23;
  if (next.dayOfWeekUtc < 0 || next.dayOfWeekUtc > 6) next.dayOfWeekUtc = 0;
  await cfgStore.setAll([next]);
  return next;
}

export interface StudentWeeklyData {
  studentName: string;
  lessonsCompletedThisWeek: number;
  totalLessonsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  courseProgress: Array<{
    courseTitle: string;
    completed: number;
    total: number;
    pct: number;
  }>;
}

export async function buildStudentData(
  studentId: string,
  enrolledCourseIds: string[],
): Promise<StudentWeeklyData | null> {
  const user = await usersStore.findUserById(studentId);
  if (!user) return null;

  const allProgress = await progressRepo.listForUser(studentId);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;
  const thisWeek = allProgress.filter(
    (p) => new Date(p.completedAt).getTime() >= weekAgo,
  );

  const streak = await progressRepo.streakInfo(studentId);
  const courses = await coursesRepo.listCourses();

  const courseProgress = enrolledCourseIds
    .map((cid) => {
      const course = courses.find((c) => c.id === cid);
      if (!course) return null;
      const totalLessons = course.modules.reduce(
        (s, m) => s + m.lessons.length,
        0,
      );
      if (totalLessons === 0) return null;
      const completed = allProgress.filter((p) => p.courseId === cid).length;
      return {
        courseTitle: course.shortTitle || course.title,
        completed,
        total: totalLessons,
        pct: Math.round((completed / totalLessons) * 100),
      };
    })
    .filter(Boolean) as StudentWeeklyData['courseProgress'];

  return {
    studentName: user.name,
    lessonsCompletedThisWeek: thisWeek.length,
    totalLessonsCompleted: allProgress.length,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    courseProgress,
  };
}

export function renderEmail(data: StudentWeeklyData): {
  subject: string;
  html: string;
  text: string;
} {
  const hasActivity = data.lessonsCompletedThisWeek > 0;
  const subject = hasActivity
    ? `Voce concluiu ${data.lessonsCompletedThisWeek} aula(s) esta semana!`
    : 'Seu resumo semanal — AVA PCO';

  const streakHtml =
    data.currentStreak > 0
      ? `<div style="padding:12px;background:#f0fdf4;border-radius:6px;text-align:center;margin-bottom:16px">
          <span style="font-size:24px">🔥</span>
          <div style="font-size:18px;font-weight:bold;color:#15803d">${data.currentStreak} dia(s) seguidos</div>
          <div style="font-size:12px;color:#64748b">Recorde: ${data.longestStreak} dias</div>
        </div>`
      : '';

  const progressBars = data.courseProgress
    .map(
      (c) =>
        `<div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#334155;margin-bottom:2px">
            <span>${escapeHtml(c.courseTitle)}</span>
            <span>${c.pct}%</span>
          </div>
          <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${c.pct}%;background:#0097B2;border-radius:3px"></div>
          </div>
        </div>`,
    )
    .join('');

  const ctaText = hasActivity
    ? 'Continue de onde parou'
    : 'Retome seus estudos';

  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <h1 style="color:#0097B2;font-size:20px;margin:0 0 4px">Ola, ${escapeHtml(data.studentName.split(' ')[0])}!</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">Seu resumo semanal de estudos.</p>

    ${streakHtml}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      <div style="padding:10px;background:#f8fafc;border-radius:6px;text-align:center">
        <div style="font-size:22px;font-weight:bold;color:#0f172a">${data.lessonsCompletedThisWeek}</div>
        <div style="font-size:11px;color:#64748b">Aulas esta semana</div>
      </div>
      <div style="padding:10px;background:#f8fafc;border-radius:6px;text-align:center">
        <div style="font-size:22px;font-weight:bold;color:#0f172a">${data.totalLessonsCompleted}</div>
        <div style="font-size:11px;color:#64748b">Total concluidas</div>
      </div>
    </div>

    ${data.courseProgress.length > 0 ? `
    <h2 style="font-size:14px;color:#0f172a;margin:0 0 10px">Progresso por curso</h2>
    ${progressBars}
    ` : ''}

    <div style="text-align:center;margin-top:20px">
      <a href="https://ava.psicanaliseclinica.online/dashboard" style="display:inline-block;padding:10px 24px;background:#0097B2;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">${ctaText}</a>
    </div>

    <p style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center">
      Voce recebe este e-mail porque esta matriculado na AVA PCO.
    </p>
  </div>
</body></html>`;

  const textLines = [
    `Ola, ${data.studentName.split(' ')[0]}!`,
    '',
    `Aulas concluidas esta semana: ${data.lessonsCompletedThisWeek}`,
    `Total concluidas: ${data.totalLessonsCompleted}`,
    `Streak: ${data.currentStreak} dia(s) (recorde: ${data.longestStreak})`,
    '',
    ...data.courseProgress.map(
      (c) => `${c.courseTitle}: ${c.pct}% (${c.completed}/${c.total})`,
    ),
    '',
    `${ctaText}: https://ava.psicanaliseclinica.online/dashboard`,
  ];

  return { subject, html, text: textLines.join('\n') };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let lastFiredKey = '';
let lastRunAt: string | null = null;
let lastResult: { sent: number; skipped: number } | null = null;

export async function tickWorker(now: Date = new Date()): Promise<{
  fired: boolean;
  sent?: number;
}> {
  const cfg = await getConfig();
  if (!cfg.enabled) return { fired: false };
  if (now.getUTCDay() !== cfg.dayOfWeekUtc) return { fired: false };
  if (now.getUTCHours() !== cfg.hourUtc) return { fired: false };

  const key = `${now.toISOString().slice(0, 10)}-${cfg.hourUtc}`;
  if (key === lastFiredKey) return { fired: false };
  lastFiredKey = key;

  const blocked = await blockedFromReengagement();
  const students = await studentsRepo.listAdminStudents({} as never);
  const active = students.filter(
    (s) => s.status === 'ativo' && !blocked.has(s.id),
  );

  let sent = 0;
  let skipped = 0;
  for (const student of active) {
    if (!student.email) {
      skipped++;
      continue;
    }
    const data = await buildStudentData(
      student.id,
      student.enrolledCourseIds ?? [],
    );
    if (!data || data.courseProgress.length === 0) {
      skipped++;
      continue;
    }

    const email = renderEmail(data);
    await sendSafe({
      to: { email: student.email, name: student.name },
      subject: email.subject,
      html: email.html,
      text: email.text,
      tag: 'student-weekly-progress',
    });
    sent++;
  }

  lastRunAt = now.toISOString();
  lastResult = { sent, skipped };
  return { fired: true, sent };
}

export function getStatus() {
  return { lastRunAt, lastResult };
}

export function startWorker(intervalMs = 60 * 60_000): NodeJS.Timeout {
  return setInterval(() => {
    void tickWorker().catch((err) => {
      console.error('[student-progress-email] erro:', err);
    });
  }, intervalMs);
}

export async function _resetForTests(): Promise<void> {
  await cfgStore.setAll([DEFAULT_CFG]);
  lastFiredKey = '';
  lastRunAt = null;
  lastResult = null;
}
