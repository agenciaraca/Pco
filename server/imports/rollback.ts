// Rollback de importação — best-effort.
// Remove referências externas criadas pelo job e, quando seguro, registros criados
// (students/products que NÃO tinham external_user_id antes do job e foram criados aqui).
//
// Não derruba enrollments aplicados ao studentsRepo (mantém histórico),
// mas remove refs cross-source para que reimport não conte como duplicado.

import * as refsStore from './refs-store';
import * as jobs from './job-store';
import * as productsRepo from '../payments/products-repo';
import type { ImportJob } from './types';

export interface RollbackResult {
  jobId: string;
  refsRemoved: number;
  productsDeactivated: number;
  notes: string[];
}

export async function rollbackJob(jobId: string): Promise<RollbackResult> {
  const job = await jobs.findJob(jobId);
  if (!job) throw new Error(`Job ${jobId} não encontrado.`);

  const notes: string[] = [];
  notes.push(`Iniciando rollback de ${jobId} (status anterior=${job.status})`);

  // 1) Desativa products criados por esse job (não deleta para manter histórico de pedidos)
  let productsDeactivated = 0;
  for (const ref of job.createdRefs) {
    if (ref.entity !== 'product') continue;
    try {
      await productsRepo.updateProduct(ref.internalId, { active: false });
      productsDeactivated++;
    } catch (err) {
      notes.push(`Falha ao desativar product ${ref.internalId}: ${(err as Error).message}`);
    }
  }
  notes.push(`Products desativados: ${productsDeactivated}`);

  // 2) Remove external_references do job
  const refsRemoved = await refsStore.deleteByJob(jobId);
  notes.push(`External refs removidas: ${refsRemoved}`);

  // 3) Marca job como rolled_back e injeta notas
  await jobs.setStatus(jobId, 'rolled_back', true);
  for (const n of notes) {
    await jobs.addNote(jobId, 'info', `[rollback] ${n}`);
  }

  return { jobId, refsRemoved, productsDeactivated, notes };
}

/** Lista o que SERIA removido sem aplicar (preview). */
export async function previewRollback(jobId: string): Promise<{
  refs: Awaited<ReturnType<typeof refsStore.listByJob>>;
  productsToDeactivate: ImportJob['createdRefs'];
  studentsCreated: ImportJob['createdRefs'];
  enrollmentsCreated: ImportJob['createdRefs'];
}> {
  const job = await jobs.findJob(jobId);
  if (!job) throw new Error(`Job ${jobId} não encontrado.`);
  const refs = await refsStore.listByJob(jobId);
  return {
    refs,
    productsToDeactivate: job.createdRefs.filter((r) => r.entity === 'product'),
    studentsCreated: job.createdRefs.filter((r) => r.entity === 'student'),
    enrollmentsCreated: job.createdRefs.filter((r) => r.entity === 'enrollment'),
  };
}
