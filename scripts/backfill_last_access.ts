/**
 * Backfill: corrige lastAccessAt em admin-students.json que ficou setado
 * como "agora" (data da migração) em vez do último acesso real do aluno
 * no portal WP.
 *
 * studentsRepo.enrollInCourse e setCourseProgress fazem
 *   lastAccessAt: new Date().toISOString()
 * quando criam o stub. Sem dado WP nesse momento, vira hoje.
 *
 * Proxy de "último acesso" usando o que o LD REST expõe:
 *   max(
 *     student.registered_date,
 *     max(progress.started_at por curso desse aluno),
 *     max(progress.completed_at por curso desse aluno),
 *   )
 *
 * Casamento:
 *   admin-students.id ──(via external-references)──→ "portal:WP_USER_ID"
 *                                                    "psi:WP_USER_ID"
 *   raw portal.json + psi.json têm os timestamps por external_user_id.
 *
 * Uso:
 *   npx tsx scripts/backfill_last_access.ts \
 *     --raw=data/migration/<TS> [--dry-run]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const RAW_DIR_ARG = argv.find((a) => a.startsWith('--raw='))?.slice('--raw='.length);
const DRY_RUN = argv.includes('--dry-run');
const DATA = path.resolve(process.cwd(), 'data');
const log = (m: string) => console.log(`[lastaccess] ${m}`);

interface RawRow {
  external_user_id?: string;
  user_external_id?: string;
  registered_date?: string;
  started_at?: string;
  completed_at?: string;
}

interface RawDump {
  rowsByEntity: {
    student?: RawRow[];
    progress?: RawRow[];
  };
}

interface Ref {
  sourceType: string;
  externalEntityType: string;
  externalId: string;
  internalEntityType: string;
  internalId: string;
}

interface AdminStudent {
  id: string;
  name: string;
  email: string;
  lastAccessAt?: string;
  enrolledCourseIds?: string[];
  progressByCourse?: Record<string, number>;
  [key: string]: unknown;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  if (DRY_RUN) {
    log(`(dry-run) escreveria ${path.basename(file)}`);
    return;
  }
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

function maxIso(...values: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  for (const v of values) {
    if (!v) continue;
    if (!best || v > best) best = v;
  }
  return best;
}

function normalizeIso(v: string | undefined): string | undefined {
  if (!v) return undefined;
  // WP entrega "2025-06-26T14:32:52+00:00" — Date entende, normaliza pra UTC
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

async function pickLatestRawDir(): Promise<string> {
  const migDir = path.join(DATA, 'migration');
  const entries = await fs.readdir(migDir);
  const dumps = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(e))
    .sort()
    .reverse();
  if (dumps.length === 0) throw new Error('nenhum dump em data/migration/');
  return path.join(migDir, dumps[0]!);
}

async function main(): Promise<void> {
  log(`mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);

  const rawDirAbs = RAW_DIR_ARG
    ? path.resolve(process.cwd(), RAW_DIR_ARG)
    : await pickLatestRawDir();
  log(`raw: ${rawDirAbs}`);

  const portal = await readJson<RawDump>(path.join(rawDirAbs, 'raw', 'portal.json'));
  const psi = await readJson<RawDump>(path.join(rawDirAbs, 'raw', 'psi.json'));

  // Mapa: prefixedExternalId → último timestamp
  const lastByExt = new Map<string, string>();

  const ingestStudents = (rows: RawRow[] | undefined, prefix: string) => {
    for (const r of rows ?? []) {
      const id = r.external_user_id;
      if (!id) continue;
      const key = `${prefix}:${id}`;
      const ts = normalizeIso(r.registered_date);
      if (ts) {
        const cur = lastByExt.get(key);
        lastByExt.set(key, maxIso(cur, ts)!);
      }
    }
  };

  const ingestProgress = (rows: RawRow[] | undefined, prefix: string) => {
    for (const r of rows ?? []) {
      const id = r.user_external_id;
      if (!id) continue;
      const key = `${prefix}:${id}`;
      const ts = maxIso(normalizeIso(r.started_at), normalizeIso(r.completed_at));
      if (ts) {
        const cur = lastByExt.get(key);
        lastByExt.set(key, maxIso(cur, ts)!);
      }
    }
  };

  ingestStudents(portal.rowsByEntity.student, 'portal');
  ingestStudents(psi.rowsByEntity.student, 'psi');
  ingestProgress(portal.rowsByEntity.progress, 'portal');
  ingestProgress(psi.rowsByEntity.progress, 'psi');

  log(`timestamps coletados para ${lastByExt.size} externalIds`);

  const refs = await readJson<Ref[]>(path.join(DATA, 'external-references.json'));
  const internalToExternal = new Map<string, string>();
  for (const r of refs) {
    if (r.internalEntityType !== 'student' || r.externalEntityType !== 'student')
      continue;
    // Se o mesmo internal tem múltiplas refs (cross-site merge por email),
    // mantém a primeira mas usamos o max abaixo via lookup
    if (!internalToExternal.has(r.internalId)) {
      internalToExternal.set(r.internalId, r.externalId);
    }
  }
  // Para alunos que vieram dos 2 sites (merge por email), juntamos timestamps
  const refsByInternal = new Map<string, string[]>();
  for (const r of refs) {
    if (r.internalEntityType !== 'student' || r.externalEntityType !== 'student')
      continue;
    const arr = refsByInternal.get(r.internalId) ?? [];
    arr.push(r.externalId);
    refsByInternal.set(r.internalId, arr);
  }
  log(`refs student internal→external: ${internalToExternal.size}`);

  const studentsFile = path.join(DATA, 'admin-students.json');
  const students = await readJson<AdminStudent[]>(studentsFile);

  let updated = 0;
  let untouched = 0;
  let noRef = 0;
  let noTimestamp = 0;
  // Limite de "hoje" para detectar valores claramente errados
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const s of students) {
    // Skip seeds (id começa com s-, não com stude-)
    if (!s.id.startsWith('stude-')) {
      untouched += 1;
      continue;
    }
    const extIds = refsByInternal.get(s.id);
    if (!extIds || extIds.length === 0) {
      noRef += 1;
      continue;
    }
    let best: string | undefined;
    for (const ext of extIds) {
      best = maxIso(best, lastByExt.get(ext));
    }
    if (!best) {
      noTimestamp += 1;
      continue;
    }
    // Só atualiza se o valor atual estiver setado pra hoje (a heurística do bug)
    // OU se for ANTERIOR ao real (caso raro, dado fica mais correto)
    const cur = s.lastAccessAt;
    const wasToday = cur && cur.slice(0, 10) === todayIso;
    const isOlder = !cur || best > cur;
    if (wasToday || isOlder) {
      s.lastAccessAt = best;
      updated += 1;
    } else {
      untouched += 1;
    }
  }

  log(`updated: ${updated}`);
  log(`untouched (seed ou já correto): ${untouched}`);
  log(`sem ref no external-references: ${noRef}`);
  log(`sem timestamp no raw: ${noTimestamp}`);

  await writeJson(studentsFile, students);
  log('done.');
}

main().catch((err) => {
  console.error('[lastaccess] erro:', err);
  process.exit(1);
});
