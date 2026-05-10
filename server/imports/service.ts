// Service de orquestração de import — recebe rows CSV (ou payload API),
// roda mapping + normalização + validação + relacionamento (sem persistir = dry-run).

import {
  validateStudent,
  validateCourse,
  validateModule,
  validateLesson,
  validateProduct,
  validateOrder,
  validateEnrollment,
  validateProgress,
} from './pipeline/validators';
import {
  normalizeStudent,
  normalizeCourse,
  normalizeModule,
  normalizeLesson,
  normalizeProduct,
  normalizeOrder,
  normalizeEnrollment,
  normalizeProgress,
} from './pipeline/normalizers';
import * as jobs from './job-store';
import * as adapters from './adapters';
import type {
  ImportEntityType,
  ImportJob,
  ImportEnrollmentConfig,
  ImportEntityConfig,
  ImportSource,
  NormalizedStudent,
  NormalizedCourse,
  NormalizedModule,
  NormalizedLesson,
  NormalizedProduct,
  NormalizedOrder,
  NormalizedEnrollment,
  NormalizedProgress,
} from './types';

interface DryRunInput {
  rowsByEntity: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>>;
  jobId: string;
}

/**
 * Executa dry-run: lê rows, normaliza e valida cada entidade.
 * Atualiza stats no job. NÃO escreve nas tabelas internas.
 */
export async function runDryRun(input: DryRunInput): Promise<void> {
  const { rowsByEntity, jobId } = input;
  const start = Date.now();
  await jobs.setStatus(jobId, 'running');
  await jobs.addNote(jobId, 'info', 'Dry-run iniciado');

  for (const [entity, rows] of Object.entries(rowsByEntity) as Array<
    [ImportEntityType, Array<Record<string, unknown>>]
  >) {
    if (jobs.isCancelRequested(jobId)) break;
    if (!rows || rows.length === 0) continue;
    await jobs.addNote(jobId, 'info', `Processando ${rows.length} ${entity}(s)`);

    let valid = 0;
    let invalid = 0;
    for (let i = 0; i < rows.length; i++) {
      if (jobs.isCancelRequested(jobId)) {
        await jobs.addNote(jobId, 'warn', `Cancelamento solicitado em ${entity} row ${i}`);
        break;
      }
      await jobs.bumpEntityStat(jobId, entity, 'read', 1);
      const row = rows[i]!;
      try {
        const errs = validateEntity(entity, row);
        if (errs.length === 0) {
          valid++;
          await jobs.bumpEntityStat(jobId, entity, 'valid', 1);
        } else {
          invalid++;
          await jobs.bumpEntityStat(jobId, entity, 'invalid', 1);
          for (const e of errs.slice(0, 5)) {
            await jobs.addError(jobId, {
              entity,
              rowIndex: i + 2, // +2 = 1 (header) + 1 (1-based)
              message: e.message,
              field: e.field,
            });
          }
        }
      } catch (err) {
        invalid++;
        await jobs.bumpEntityStat(jobId, entity, 'errors', 1);
        await jobs.addError(jobId, {
          entity,
          rowIndex: i + 2,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await jobs.addNote(
      jobId,
      'info',
      `${entity}: ${valid} válidos, ${invalid} inválidos`,
    );
  }

  const ms = Date.now() - start;
  await jobs.setDuration(jobId, ms);
  const cancelled = jobs.isCancelRequested(jobId);
  const finalJob = await jobs.findJob(jobId);
  const status: ImportJob['status'] = cancelled
    ? 'canceled'
    : (finalJob?.stats.errors ?? 0) > 0
      ? 'completed_with_errors'
      : 'completed';
  await jobs.setStatus(jobId, status, true);
  jobs.clearCancel(jobId);
  await jobs.addNote(
    jobId,
    cancelled ? 'warn' : 'info',
    cancelled
      ? `Dry-run cancelado pelo usuário em ${ms}ms`
      : `Dry-run finalizado em ${ms}ms`,
  );
}

interface RealRunInput {
  rowsByEntity: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>>;
  jobId: string;
  source: ImportSource;
  enrollmentRules?: ImportEnrollmentConfig;
  // Por entidade — estratégia padrão de conflito (default 'update')
  entityConfigs?: Partial<Record<ImportEntityType, Pick<ImportEntityConfig, 'conflictStrategy'>>>;
}

/**
 * Execução real — varre rows, valida, e aplica via adapters (persiste no AVA).
 * Ordem fixa para respeitar dependências: course → student → product → order → enrollment → progress.
 */
export async function runReal(input: RealRunInput): Promise<void> {
  const { rowsByEntity, jobId, source } = input;
  const start = Date.now();
  await jobs.setStatus(jobId, 'running');
  await jobs.addNote(jobId, 'info', 'Execução real iniciada');

  const ORDER: ImportEntityType[] = [
    'course',
    'student',
    'product',
    'order',
    'enrollment',
    'progress',
    'module',
    'lesson',
  ];
  for (const entity of ORDER) {
    if (jobs.isCancelRequested(jobId)) break;
    const rows = rowsByEntity[entity];
    if (!rows || rows.length === 0) continue;
    // Prioridade: per-entity > enrollment.conflictStrategy global > default 'update'
    const conflictStrategy =
      input.entityConfigs?.[entity]?.conflictStrategy ??
      input.enrollmentRules?.conflictStrategy ??
      'update';
    const cfg: ImportEntityConfig = {
      entity,
      enabled: true,
      mappings: [],
      conflictStrategy,
      matchKeys: [],
    };
    await jobs.addNote(jobId, 'info', `Aplicando ${rows.length} ${entity}(s)`);

    for (let i = 0; i < rows.length; i++) {
      if (jobs.isCancelRequested(jobId)) {
        await jobs.addNote(jobId, 'warn', `Cancelamento solicitado em ${entity} row ${i}`);
        break;
      }
      await jobs.bumpEntityStat(jobId, entity, 'read', 1);
      const row = rows[i]!;
      try {
        // Valida primeiro
        const errs = validateEntity(entity, row);
        const skipErrors = input.enrollmentRules?.skipValidationErrors === true;
        if (errs.length > 0) {
          // Loga warnings independente de skipErrors (pra auditoria)
          for (const e of errs.slice(0, 3)) {
            await jobs.addError(jobId, {
              entity,
              rowIndex: i + 2,
              message: skipErrors ? `[WARNING ignorado] ${e.message}` : e.message,
              field: e.field,
            });
          }
          if (!skipErrors) {
            await jobs.bumpEntityStat(jobId, entity, 'invalid', 1);
            continue;
          }
          // skipErrors=true: marca invalid pra contagem mas continua tentando criar
          await jobs.bumpEntityStat(jobId, entity, 'invalid', 1);
        } else {
          await jobs.bumpEntityStat(jobId, entity, 'valid', 1);
        }

        // Aplica via adapter
        const ctx = {
          jobId,
          source,
          enrollmentRules: input.enrollmentRules,
        };
        let res: { outcome: 'created' | 'updated' | 'ignored' | 'error'; message?: string };

        switch (entity) {
          case 'student':
            res = await adapters.upsertStudent(normalizeStudent(row), cfg, ctx);
            break;
          case 'course':
            res = await adapters.registerCourseRef(normalizeCourse(row), ctx);
            break;
          case 'product':
            res = await adapters.upsertProduct(normalizeProduct(row), cfg, ctx);
            break;
          case 'order':
            res = await adapters.upsertOrder(normalizeOrder(row), cfg, ctx);
            break;
          case 'enrollment':
            res = await adapters.applyEnrollment(normalizeEnrollment(row), cfg, ctx);
            break;
          default:
            // module/lesson/progress: não modificam dados sensíveis. Só registram refs/logs.
            res = { outcome: 'ignored', message: 'Entidade ainda não persistida (refs only).' };
            break;
        }

        if (res.outcome === 'created') await jobs.bumpEntityStat(jobId, entity, 'created', 1);
        else if (res.outcome === 'updated')
          await jobs.bumpEntityStat(jobId, entity, 'updated', 1);
        else if (res.outcome === 'ignored')
          await jobs.bumpEntityStat(jobId, entity, 'ignored', 1);
        else if (res.outcome === 'error') {
          await jobs.bumpEntityStat(jobId, entity, 'errors', 1);
          await jobs.addError(jobId, {
            entity,
            rowIndex: i + 2,
            message: res.message ?? 'Falha na aplicação.',
          });
        }
      } catch (err) {
        await jobs.bumpEntityStat(jobId, entity, 'errors', 1);
        await jobs.addError(jobId, {
          entity,
          rowIndex: i + 2,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const ms = Date.now() - start;
  await jobs.setDuration(jobId, ms);
  const cancelled = jobs.isCancelRequested(jobId);
  const finalJob = await jobs.findJob(jobId);
  const status: ImportJob['status'] = cancelled
    ? 'canceled'
    : (finalJob?.stats.errors ?? 0) > 0
      ? 'completed_with_errors'
      : 'completed';
  await jobs.setStatus(jobId, status, true);
  jobs.clearCancel(jobId);
  await jobs.addNote(
    jobId,
    cancelled ? 'warn' : 'info',
    cancelled
      ? `Execução cancelada pelo usuário em ${ms}ms`
      : `Execução real finalizada em ${ms}ms`,
  );
}

function validateEntity(
  entity: ImportEntityType,
  row: Record<string, unknown>,
): Array<{ field?: string; message: string }> {
  switch (entity) {
    case 'student':
      return validateStudent(normalizeStudent(row) as NormalizedStudent);
    case 'course':
      return validateCourse(normalizeCourse(row) as NormalizedCourse);
    case 'module':
      return validateModule(normalizeModule(row) as NormalizedModule);
    case 'lesson':
      return validateLesson(normalizeLesson(row) as NormalizedLesson);
    case 'product':
      return validateProduct(normalizeProduct(row) as NormalizedProduct);
    case 'order':
      return validateOrder(normalizeOrder(row) as NormalizedOrder);
    case 'enrollment':
      return validateEnrollment(normalizeEnrollment(row) as NormalizedEnrollment);
    case 'progress':
      return validateProgress(normalizeProgress(row) as NormalizedProgress);
    // Entidades auxiliares LD que entram no import mas nao tem schema proprio
    // no AVA (sao usadas pra construir relacionamentos). Considera valido se
    // tiver pelo menos um id discernivel.
    case 'topic':
    case 'quiz':
    case 'question':
    case 'group':
      if (
        row.id ||
        row.external_topic_id ||
        row.external_quiz_id ||
        row.external_question_id ||
        row.external_group_id ||
        row.title
      ) {
        return [];
      }
      return [{ message: `${entity} sem id discernivel.` }];
    default:
      return [{ message: `Entidade desconhecida: ${entity}` }];
  }
}
