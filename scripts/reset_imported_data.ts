/**
 * Reset destrutivo dos dados importados (mantém seeds e contas locais).
 *
 * Necessário para re-rodar a migração após patch crítico (prefixo de IDs +
 * filtro spam). Sem reset, refs antigos apontam pros users errados criados
 * pela versão buggy.
 *
 * Mantém:
 *   - superadmin@pco.local, admin@pco.local, aluno@pco.local (seed AVA)
 *   - admin@psicanaliseclinica.online (criado pelo ensure_superadmin)
 *   - Cursos seed antigos (c-psi, c-tfs, c-hipno) — não foram importados
 *   - 8 alunos seed do admin-students.json (que tinham emails @example.com)
 *
 * Remove:
 *   - 1638 users importados de WP (qualquer user com role student que não
 *     tenha email @pco.local)
 *   - admin-students.json: linhas com id começando com "stude-mp" (gerados
 *     pelos imports) ou com 1641 ids importados
 *   - external-references.json inteiro (vai ser recriado)
 *   - import-jobs.json inteiro (3 jobs ficam só no histórico do dump)
 *
 * Uso: npx tsx scripts/reset_imported_data.ts [--dry-run]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const KEEP_USER_EMAILS = new Set([
  'superadmin@pco.local',
  'admin@pco.local',
  'aluno@pco.local',
  'admin@psicanaliseclinica.online',
]);

const DATA = path.resolve(process.cwd(), 'data');

const log = (m: string) => console.log(`[reset] ${m}`);

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

  // 1) users.json — manter só os emails da whitelist
  const users = await readJson<Array<{ email: string; role: string }>>('users.json');
  const keptUsers = users.filter((u) => KEEP_USER_EMAILS.has(u.email.toLowerCase()));
  log(`users.json: ${users.length} → ${keptUsers.length} (removendo ${users.length - keptUsers.length})`);
  await writeJson('users.json', keptUsers);

  // 2) admin-students.json — manter só os seed (emails @example.com ou ids antigos)
  const admin = await readJson<Array<{ id: string; email: string }>>('admin-students.json');
  const keptAdmin = admin.filter(
    (s) =>
      (s.email && s.email.endsWith('@example.com')) ||
      s.id.startsWith('s-'),
  );
  log(`admin-students.json: ${admin.length} → ${keptAdmin.length}`);
  await writeJson('admin-students.json', keptAdmin);

  // 3) external-references.json — zerar
  const refs = await readJson<unknown[]>('external-references.json');
  log(`external-references.json: ${refs.length} → 0`);
  await writeJson('external-references.json', []);

  // 4) import-jobs.json — zerar
  const jobs = await readJson<unknown[]>('import-jobs.json');
  log(`import-jobs.json: ${jobs.length} → 0`);
  await writeJson('import-jobs.json', []);

  // 5) payment-products.json — opcional, vamos manter mas resetar campos
  // (refId vai ser repopulado pelo import_lessons_and_map_products)
  log(`payment-products.json: mantido (será re-mapeado depois)`);

  log('done.');
}

main().catch((err) => {
  console.error('[reset] erro:', err);
  process.exit(1);
});
