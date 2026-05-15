/**
 * Migração end-to-end dos dois sites WP de origem para o AVA.
 *
 * - portalpco.online (LMS LearnDash): students, courses, lessons, topics,
 *   questions, enrollments, progress.
 * - psicanaliseclinica.online (loja WooCommerce + base de clientes):
 *   students (customers), products, orders.
 *
 * Carrega creds de `Pco/.env.import` (gitignored). Reusa a infra de import
 * existente (connections-store, orchestrator, service, adapters).
 *
 * Uso:
 *   tsx scripts/migrate_wp_to_ava.ts --dry-run    # só valida, não persiste
 *   tsx scripts/migrate_wp_to_ava.ts --apply      # roda real
 *   tsx scripts/migrate_wp_to_ava.ts --collect-only  # só baixa raw, sem dry/apply
 *
 * Detalhes em docs/migration-wp-ld.md.
 */

import { config as loadEnv } from 'dotenv';
import { promises as fs } from 'node:fs';
import path from 'node:path';

loadEnv({ path: '.env.import' });

import {
  createConnection,
  listConnections,
  getConnection,
  recordTestResult,
  type ImportConnection,
} from '../server/imports/connections-store';
import {
  collectFromApi,
  type CollectResult,
} from '../server/imports/connectors/orchestrator';
import { runDryRun, runReal } from '../server/imports/service';
import { createJob } from '../server/imports/job-store';
import type {
  ImportEntityType,
  ImportEnrollmentConfig,
} from '../server/imports/types';

// ---------- CLI ----------

const argv = process.argv.slice(2);
const args = new Set(argv);
const DRY_RUN = args.has('--dry-run');
const APPLY = args.has('--apply');
const COLLECT_ONLY = args.has('--collect-only');
const VERBOSE = args.has('--verbose');
const FROM_RAW = argv.find((a) => a.startsWith('--from-raw='))?.slice('--from-raw='.length);

if (!DRY_RUN && !APPLY && !COLLECT_ONLY) {
  console.error(
    'Uso: tsx scripts/migrate_wp_to_ava.ts [--dry-run | --apply | --collect-only] [--from-raw=<dir>] [--verbose]\n' +
      '  --dry-run               Coleta (ou usa raw) + valida, NÃO persiste\n' +
      '  --apply                 Coleta (ou usa raw) + valida + persiste (gravação real)\n' +
      '  --collect-only          Só baixa raw em data/migration/<ts>/raw/, sem rodar pipeline\n' +
      '  --from-raw=<dir>        Reusa portal.json e psi.json de um dump anterior (pula coleta)',
  );
  process.exit(1);
}

// ---------- Helpers ----------

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[migration] env ausente: ${name} (verifique .env.import)`);
    process.exit(2);
  }
  return v;
}

const log = (msg: string) => console.log(`[migration] ${msg}`);
const verbose = (msg: string) => VERBOSE && console.log(`[migration:debug] ${msg}`);

// ---------- Setup das connections ----------

const PORTAL_NAME = 'portalpco.online (migration)';
const PSI_NAME = 'psicanaliseclinica.online (migration)';

async function ensureConnection(
  name: string,
  siteUrl: string,
  wpUser: string,
  wpAppPassword: string,
  // Para WC, reusa as mesmas credenciais como Basic Auth (Application Password
  // funciona quando o user tem manage_woocommerce, que admin tem).
  withWcKeys: boolean,
): Promise<ImportConnection> {
  const all = await listConnections();
  const existing = all.find((c) => c.name === name);
  if (existing) {
    log(`reuso connection "${name}" (${existing.id})`);
    const full = await getConnection(existing.id);
    if (!full) throw new Error(`connection ${existing.id} sumiu`);
    return full;
  }
  log(`criando connection "${name}"`);
  const pub = await createConnection({
    name,
    siteUrl,
    wpUsername: wpUser,
    wpAppPassword,
    ...(withWcKeys
      ? { wcConsumerKey: wpUser, wcConsumerSecret: wpAppPassword }
      : {}),
    defaultUserMatchKeys: ['email', 'external_id', 'wp_user_id'],
    defaultConflictStrategy: 'update',
  });
  const full = await getConnection(pub.id);
  if (!full) throw new Error(`connection ${pub.id} não foi persistida`);
  return full;
}

// ---------- Merge cross-source ----------
//
// Alunos vêm dos dois sites. Match por email vence — usuários do PSI que
// têm o mesmo email de um user do portal viram a mesma entidade no AVA
// (sem duplicar). Orders sempre vão pra customers do PSI (que viraram
// students por email).
//
// Estratégia: concatenar `student` rows dos 2 sites num único array,
// deixando os do portal primeiro (já que têm progressão). O `adapter.upsertStudent`
// faz dedup por email automaticamente.

function mergeRows(
  portal: CollectResult,
  psi: CollectResult,
): Partial<Record<ImportEntityType, Array<Record<string, unknown>>>> {
  const merged: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>> = {};

  const concat = (e: ImportEntityType) => {
    const a = portal.rowsByEntity[e] ?? [];
    const b = psi.rowsByEntity[e] ?? [];
    if (a.length === 0 && b.length === 0) return;
    merged[e] = [...a, ...b];
  };

  for (const e of [
    'student',
    'course',
    'lesson',
    'topic',
    'quiz',
    'question',
    'group',
    'product',
    'order',
    'enrollment',
    'progress',
    'module',
  ] as ImportEntityType[]) {
    concat(e);
  }
  return merged;
}

// ---------- Salvar dumps raw ----------

async function dumpRaw(
  baseDir: string,
  label: string,
  data: unknown,
): Promise<void> {
  const file = path.join(baseDir, `${label}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  verbose(`dump → ${file}`);
}

// ---------- Main ----------

async function main(): Promise<void> {
  const startTs = Date.now();
  const mode = APPLY ? 'APPLY' : DRY_RUN ? 'DRY-RUN' : 'COLLECT-ONLY';
  log(`==== início (modo: ${mode}) ====`);

  // 1) Setup connections
  const connPortal = await ensureConnection(
    PORTAL_NAME,
    need('PORTAL_PCO_URL'),
    need('PORTAL_PCO_USER'),
    need('PORTAL_PCO_APP_PASSWORD'),
    /* withWcKeys */ false, // portal não tem WC
  );
  const connPsi = await ensureConnection(
    PSI_NAME,
    need('PSICANALISE_URL'),
    need('PSICANALISE_USER'),
    need('PSICANALISE_APP_PASSWORD'),
    /* withWcKeys */ true,
  );

  // Pasta de dumps — usa FROM_RAW se fornecida; senão cria nova
  const dumpDir = FROM_RAW
    ? path.resolve(process.cwd(), FROM_RAW)
    : path.resolve(
        process.cwd(),
        'data/migration',
        new Date().toISOString().replace(/[:.]/g, '-'),
      );
  await fs.mkdir(path.join(dumpDir, 'raw'), { recursive: true });
  log(`dumps em: ${dumpDir}`);

  let portalResult: CollectResult;
  let psiResult: CollectResult;

  if (FROM_RAW) {
    log(`reusando raw de ${FROM_RAW}/raw/portal.json e psi.json (pula coleta)...`);
    const rawPortal = await fs.readFile(path.join(dumpDir, 'raw', 'portal.json'), 'utf8');
    const rawPsi = await fs.readFile(path.join(dumpDir, 'raw', 'psi.json'), 'utf8');
    portalResult = JSON.parse(rawPortal) as CollectResult;
    psiResult = JSON.parse(rawPsi) as CollectResult;
    log(`portal (raw): ${portalResult.totalRows} rows`);
    log(`psi (raw): ${psiResult.totalRows} rows`);
  } else {
    // 2) Coleta — portal (LMS)
    log('coletando do portalpco (students, courses, lessons, topics, questions, enrollments, progress)...');
    portalResult = await collectFromApi(connPortal, {
      entities: [
        'student',
        'course',
        'lesson',
        'topic',
        'question',
        'enrollment',
        'progress',
      ],
    });
    log(
      `portal: ${portalResult.totalRows} rows | ${Object.entries(portalResult.perEntity)
        .map(([e, n]) => `${e}=${n}`)
        .join(' ')}`,
    );
    if (portalResult.skipped.length > 0) {
      log(
        `portal skipped: ${portalResult.skipped.map((s) => `${s.entity}(${s.reason})`).join(', ')}`,
      );
    }
    await dumpRaw(path.join(dumpDir, 'raw'), 'portal', portalResult);
    await recordTestResult(connPortal.id, 'ok', `coletou ${portalResult.totalRows} rows`);

    // 3) Coleta — psi (loja)
    log('coletando da loja psicanaliseclinica (students/customers, products, orders)...');
    psiResult = await collectFromApi(connPsi, {
      entities: ['student', 'product', 'order'],
    });
    log(
      `psi: ${psiResult.totalRows} rows | ${Object.entries(psiResult.perEntity)
        .map(([e, n]) => `${e}=${n}`)
        .join(' ')}`,
    );
    if (psiResult.skipped.length > 0) {
      log(
        `psi skipped: ${psiResult.skipped.map((s) => `${s.entity}(${s.reason})`).join(', ')}`,
      );
    }
    await dumpRaw(path.join(dumpDir, 'raw'), 'psi', psiResult);
    await recordTestResult(connPsi.id, 'ok', `coletou ${psiResult.totalRows} rows`);
  }

  if (COLLECT_ONLY) {
    log(`==== fim collect-only em ${Math.round((Date.now() - startTs) / 1000)}s ====`);
    log(`raw salvo em ${dumpDir}/raw/`);
    return;
  }

  // 4) Merge cross-source
  const merged = mergeRows(portalResult, psiResult);
  const totalMerged = Object.entries(merged).reduce(
    (acc, [_, rows]) => acc + (rows?.length ?? 0),
    0,
  );
  log(
    `merged: ${totalMerged} rows | ${Object.entries(merged)
      .map(([e, r]) => `${e}=${r?.length ?? 0}`)
      .join(' ')}`,
  );

  // 5) Cria o ImportJob
  const enrollment: ImportEnrollmentConfig = {
    startRule: 'now',
    expirationRule: 'lifetime',
    wcStatusMap: {
      completed: 'completed',
      processing: 'active',
      pending: 'pending',
      'on-hold': 'pending',
      cancelled: 'cancelled',
      refunded: 'cancelled',
      failed: 'cancelled',
    },
    userMatchKeys: ['email', 'external_id', 'wp_user_id'],
    unmatchedUserPolicy: 'create_stub',
    conflictStrategy: 'update',
    skipValidationErrors: true,
  };

  const job = await createJob({
    source: 'learndash',
    mode: 'api',
    api: {
      source: 'wordpress',
      baseUrl: connPortal.siteUrl,
      authType: 'application_password',
      username: connPortal.wpUsername,
    },
    entities: [],
    enrollment,
    dryRun: DRY_RUN,
    startedBy: 'migration-script',
    startedById: 'system',
    presetId: null,
  });
  log(`job criado: ${job.id} (dryRun=${DRY_RUN})`);

  // 6) Executa pipeline
  if (DRY_RUN) {
    log('rodando dry-run (valida + conta, NÃO persiste)...');
    await runDryRun({ rowsByEntity: merged, jobId: job.id });
  } else {
    log('rodando RUN REAL (persiste em data/*.json)...');
    await runReal({
      rowsByEntity: merged,
      jobId: job.id,
      source: 'learndash',
      enrollmentRules: enrollment,
    });
  }

  // 7) Relatório final
  const { findJob } = await import('../server/imports/job-store');
  const finalJob = await findJob(job.id);
  if (!finalJob) {
    log('job sumiu — algo deu muito errado');
    process.exit(3);
  }

  log('==== relatório ====');
  log(`status: ${finalJob.status}`);
  log(`duration: ${(finalJob.stats.durationMs / 1000).toFixed(1)}s`);
  log(`totalRead: ${finalJob.stats.totalRead}`);
  log(`valid: ${finalJob.stats.valid} | invalid: ${finalJob.stats.invalid}`);
  log(`created: ${finalJob.stats.created} | updated: ${finalJob.stats.updated} | ignored: ${finalJob.stats.ignored}`);
  log(`errors: ${finalJob.stats.errors}`);
  log('perEntity:');
  for (const [e, s] of Object.entries(finalJob.perEntity)) {
    if (!s) continue;
    log(
      `  ${e.padEnd(12)} read=${s.read} valid=${s.valid} invalid=${s.invalid} ` +
        `created=${s.created} updated=${s.updated} ignored=${s.ignored} errors=${s.errors}`,
    );
  }
  if (finalJob.errorsLog.length > 0) {
    log(`primeiros 10 erros (de ${finalJob.errorsLog.length}):`);
    for (const e of finalJob.errorsLog.slice(0, 10)) {
      log(`  [${e.entity} row ${e.rowIndex}] ${e.message}`);
    }
  }

  // Salva report consolidado em disco
  await fs.writeFile(
    path.join(dumpDir, 'report.json'),
    JSON.stringify(finalJob, null, 2),
    'utf8',
  );
  log(`relatório completo: ${dumpDir}/report.json`);
  log(`==== fim em ${Math.round((Date.now() - startTs) / 1000)}s ====`);
}

main().catch((err) => {
  console.error('[migration] erro fatal:', err);
  process.exit(1);
});
