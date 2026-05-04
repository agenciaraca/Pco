// Relatórios de importação — exportação CSV/JSON do job (resumo, erros, refs criadas).

import * as jobs from './job-store';
import * as refsStore from './refs-store';
import type { ImportJob } from './types';

const BOM = '﻿';

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportJobAsJson(jobId: string): Promise<string> {
  const job = await jobs.findJob(jobId);
  if (!job) throw new Error(`Job ${jobId} não encontrado.`);
  const refs = await refsStore.listByJob(jobId);
  return JSON.stringify({ job, externalReferences: refs }, null, 2);
}

export async function exportJobAsCsv(jobId: string): Promise<string> {
  const job = await jobs.findJob(jobId);
  if (!job) throw new Error(`Job ${jobId} não encontrado.`);
  const lines: string[] = [];

  lines.push('# Resumo do job');
  lines.push(['campo', 'valor'].join(','));
  const summaryRows: Array<[string, unknown]> = [
    ['id', job.id],
    ['source', job.source],
    ['mode', job.mode],
    ['dryRun', job.dryRun],
    ['startedBy', job.startedBy],
    ['startedAt', job.startedAt],
    ['finishedAt', job.finishedAt ?? ''],
    ['status', job.status],
    ['durationMs', job.stats.durationMs],
    ['totalRead', job.stats.totalRead],
    ['valid', job.stats.valid],
    ['invalid', job.stats.invalid],
    ['created', job.stats.created],
    ['updated', job.stats.updated],
    ['ignored', job.stats.ignored],
    ['errors', job.stats.errors],
  ];
  for (const [k, v] of summaryRows) lines.push([esc(k), esc(v)].join(','));

  lines.push('');
  lines.push('# Por entidade');
  lines.push(['entity', 'read', 'valid', 'invalid', 'created', 'updated', 'ignored', 'errors'].join(','));
  for (const [entity, stat] of Object.entries(job.perEntity)) {
    if (!stat) continue;
    lines.push(
      [entity, stat.read, stat.valid, stat.invalid, stat.created, stat.updated, stat.ignored, stat.errors]
        .map(esc)
        .join(','),
    );
  }

  lines.push('');
  lines.push('# Erros (primeiros 1000)');
  lines.push(['rowIndex', 'entity', 'field', 'message'].join(','));
  for (const e of job.errorsLog) {
    lines.push([esc(e.rowIndex), esc(e.entity), esc(e.field ?? ''), esc(e.message)].join(','));
  }

  lines.push('');
  lines.push('# Referências criadas');
  lines.push(['entity', 'internalId', 'externalId'].join(','));
  for (const r of job.createdRefs) {
    lines.push([esc(r.entity), esc(r.internalId), esc(r.externalId ?? '')].join(','));
  }

  return BOM + lines.join('\r\n');
}

export interface JobsListFilter {
  status?: ImportJob['status'];
  source?: ImportJob['source'];
  mode?: ImportJob['mode'];
  dryRun?: boolean;
  dateFrom?: string; // ISO
  dateTo?: string;
  q?: string; // busca id/startedBy
  limit?: number;
}

export async function listJobsFiltered(filter: JobsListFilter): Promise<ImportJob[]> {
  const all = await jobs.listJobs(1000);
  return all
    .filter((j) => (filter.status ? j.status === filter.status : true))
    .filter((j) => (filter.source ? j.source === filter.source : true))
    .filter((j) => (filter.mode ? j.mode === filter.mode : true))
    .filter((j) => (filter.dryRun !== undefined ? j.dryRun === filter.dryRun : true))
    .filter((j) => (filter.dateFrom ? j.startedAt >= filter.dateFrom : true))
    .filter((j) => (filter.dateTo ? j.startedAt <= filter.dateTo : true))
    .filter((j) => {
      if (!filter.q) return true;
      const q = filter.q.toLowerCase();
      return j.id.toLowerCase().includes(q) || j.startedBy.toLowerCase().includes(q);
    })
    .slice(0, Math.max(1, Math.min(filter.limit ?? 200, 1000)));
}
