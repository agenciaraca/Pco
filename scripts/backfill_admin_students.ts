/**
 * Backfill: corrige entries em admin-students.json que ficaram com
 * name = id e email = '' porque studentsRepo.enrollInCourse cria stub
 * sem hidratar do users.json.
 *
 * Casamento: admin-students.id === users.id (mesmo internalId gerado
 * pelo upsertStudent).
 *
 * Uso: npx tsx scripts/backfill_admin_students.ts [--dry-run]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const DATA = path.resolve(process.cwd(), 'data');
const log = (m: string) => console.log(`[backfill] ${m}`);

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

interface AdminStudent {
  id: string;
  name: string;
  email: string;
  status?: string;
  enrolledCourseIds?: string[];
  progressByCourse?: Record<string, number>;
  lastAccessAt?: string;
  createdAt?: string;
  enrollmentDates?: Record<string, string>;
  [key: string]: unknown;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DATA, file), 'utf8')) as T;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  if (DRY_RUN) {
    log(`(dry-run) escreveria ${file}`);
    return;
  }
  await fs.writeFile(
    path.join(DATA, file),
    JSON.stringify(data, null, 2),
    'utf8',
  );
}

async function main(): Promise<void> {
  log(`mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);

  const users = await readJson<User[]>('users.json');
  const students = await readJson<AdminStudent[]>('admin-students.json');

  const userById = new Map(users.map((u) => [u.id, u]));

  let hydrated = 0;
  let alreadyOk = 0;
  let noMatch = 0;
  const noMatchIds: string[] = [];

  for (const s of students) {
    const needsName = !s.name || s.name === s.id;
    const needsEmail = !s.email;
    if (!needsName && !needsEmail) {
      alreadyOk += 1;
      continue;
    }
    const u = userById.get(s.id);
    if (!u) {
      noMatch += 1;
      noMatchIds.push(s.id);
      continue;
    }
    if (needsName && u.name) s.name = u.name;
    if (needsEmail && u.email) s.email = u.email;
    if (!s.createdAt && u.createdAt) s.createdAt = u.createdAt;
    hydrated += 1;
  }

  log(`hydrated: ${hydrated}`);
  log(`already OK: ${alreadyOk}`);
  log(`no match in users.json: ${noMatch}`);
  if (noMatch > 0) {
    log(`  primeiros 5 sem match: ${noMatchIds.slice(0, 5).join(', ')}`);
  }

  await writeJson('admin-students.json', students);
  log('done.');
}

main().catch((err) => {
  console.error('[backfill] erro:', err);
  process.exit(1);
});
