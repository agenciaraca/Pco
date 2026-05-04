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
import type {
  ImportEntityType,
  ImportJob,
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
    if (!rows || rows.length === 0) continue;
    await jobs.addNote(jobId, 'info', `Processando ${rows.length} ${entity}(s)`);

    let valid = 0;
    let invalid = 0;
    for (let i = 0; i < rows.length; i++) {
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
  const finalJob = await jobs.findJob(jobId);
  const status: ImportJob['status'] =
    (finalJob?.stats.errors ?? 0) > 0 ? 'completed_with_errors' : 'completed';
  await jobs.setStatus(jobId, status, true);
  await jobs.addNote(jobId, 'info', `Dry-run finalizado em ${ms}ms`);
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
    default:
      return [{ message: `Entidade desconhecida: ${entity}` }];
  }
}
