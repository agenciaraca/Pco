// Helper compartilhado para disparar importação via API a partir do endpoint
// /admin/imports/run/api OU do worker de schedules. Cria job, dispara em
// background e retorna o jobId imediatamente.

import { runDryRun, runReal } from './service';
import { collectFromApi } from './connectors/orchestrator';
import * as importConnections from './connections-store';
import * as importJobs from './job-store';
import type {
  ImportEntityType,
  ImportEnrollmentConfig,
  ImportSource,
} from './types';

export interface TriggerApiImportInput {
  connectionId: string;
  entities: ImportEntityType[];
  dryRun: boolean;
  enrollmentRules: ImportEnrollmentConfig;
  startedBy: string;
  startedById: string;
}

export interface TriggerResult {
  jobId: string;
  dryRun: boolean;
  entities: ImportEntityType[];
}

export async function triggerApiImport(
  input: TriggerApiImportInput,
): Promise<TriggerResult> {
  const conn = await importConnections.getConnection(input.connectionId);
  if (!conn) throw new Error(`Conexão ${input.connectionId} não encontrada.`);

  const job = await importJobs.createJob({
    source: 'wordpress' as ImportSource,
    mode: 'api',
    dryRun: input.dryRun,
    entities: [],
    enrollment: input.enrollmentRules,
    startedBy: input.startedBy,
    startedById: input.startedById,
  });

  void (async () => {
    try {
      await importJobs.addNote(
        job.id,
        'info',
        `Coletando via API (${input.entities.join(', ')})`,
      );
      const collected = await collectFromApi(conn, { entities: input.entities });
      await importJobs.addNote(
        job.id,
        'info',
        `Coletados ${collected.totalRows} registros no total`,
      );
      if (input.dryRun) {
        await runDryRun({
          rowsByEntity: collected.rowsByEntity,
          jobId: job.id,
        });
      } else {
        await runReal({
          rowsByEntity: collected.rowsByEntity,
          jobId: job.id,
          source: 'wordpress',
          enrollmentRules: input.enrollmentRules,
        });
      }
    } catch (err) {
      await importJobs.addNote(
        job.id,
        'error',
        `Falha API: ${err instanceof Error ? err.message : String(err)}`,
      );
      await importJobs.setStatus(job.id, 'failed', true);
    }
  })();

  return { jobId: job.id, dryRun: input.dryRun, entities: input.entities };
}
