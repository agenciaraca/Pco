import {
  Cog,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useJobs, useRunJob } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { JobStatusDto } from '../../data/api';

export default function AdminJobs() {
  useDocumentMeta({ title: 'Jobs / Workers — Admin' });
  const jobsQ = useJobs();
  const runMut = useRunJob();
  const toast = useToast();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Cog size={20} className="text-pco-blue" strokeWidth={1.75} />
          Jobs & workers em background
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Workers que rodam em loop dentro do servidor. Refresh automático a cada 10s.
        </p>
      </header>

      {jobsQ.isLoading ? (
        <div className="text-sm text-ink-muted">Carregando...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(jobsQ.data?.jobs ?? []).map((job) => (
            <JobCard
              key={job.name}
              job={job}
              onRun={async (dryRun) => {
                try {
                  await runMut.mutateAsync({ name: job.name, dryRun });
                  toast.success(`Job ${job.name} executado`);
                } catch (err) {
                  toast.error('Falha', err instanceof Error ? err.message : 'Erro');
                }
              }}
              isPending={runMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  onRun,
  isPending,
}: {
  job: JobStatusDto;
  onRun: (dryRun: boolean) => void;
  isPending: boolean;
}) {
  const isHealthy = job.enabled && (!job.lastRunAt || isRecent(job.lastRunAt, job.intervalMs * 3));
  const supportsDryRun = job.name === 'reengagement';

  return (
    <div className="pco-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-pco-deep">{job.name}</h3>
        {job.enabled ? (
          <span className="pco-badge bg-status-success/10 text-status-success">
            <CheckCircle2 size={10} strokeWidth={2} />
            ativo
          </span>
        ) : (
          <span className="pco-badge bg-status-danger/15 text-status-danger">
            <AlertCircle size={10} strokeWidth={2} />
            parado
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Intervalo" value={formatInterval(job.intervalMs)} />
        <Stat
          label="Última execução"
          value={
            job.lastRunAt
              ? new Date(job.lastRunAt).toLocaleString('pt-BR')
              : '— ainda não rodou —'
          }
        />
        <Stat label="Total de ticks" value={String(job.totalTicks)} />
        {job.running !== undefined && (
          <Stat label="Rodando agora" value={job.running ? 'sim' : 'não'} />
        )}
        {job.pending !== undefined && (
          <Stat
            label="Pendentes"
            value={String(job.pending)}
            color={job.pending > 0 ? 'text-pco-orange' : 'text-pco-deep'}
          />
        )}
        {job.totalDeliveries !== undefined && (
          <Stat label="Total entregas" value={String(job.totalDeliveries)} />
        )}
        {job.recentEmails24h !== undefined && (
          <Stat label="E-mails 24h" value={String(job.recentEmails24h)} />
        )}
        {job.lastRunResult && (
          <>
            <Stat
              label="Última: lidos"
              value={String(job.lastRunResult.scanned)}
            />
            <Stat
              label="Última: enviados"
              value={String(job.lastRunResult.sent)}
              color="text-pco-blue"
            />
            <Stat
              label="Última: erros"
              value={String(job.lastRunResult.errors)}
              color={job.lastRunResult.errors > 0 ? 'text-status-danger' : undefined}
            />
          </>
        )}
      </dl>

      {!isHealthy && job.enabled && job.lastRunAt && (
        <div className="text-[11px] text-pco-orange flex items-center gap-1">
          <Clock size={11} strokeWidth={1.75} />
          Última execução foi há mais de {formatInterval(job.intervalMs * 3)}.
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {supportsDryRun && (
          <button
            type="button"
            onClick={() => onRun(true)}
            disabled={isPending}
            className="pco-btn-ghost text-xs"
          >
            <RefreshCw size={11} strokeWidth={2} />
            Dry-run agora
          </button>
        )}
        <button
          type="button"
          onClick={() => onRun(false)}
          disabled={isPending}
          className="pco-btn-primary text-xs"
        >
          <Play size={11} strokeWidth={2} />
          Executar agora
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-ink-subtle">{label}</dt>
      <dd className={`font-semibold ${color ?? 'text-pco-deep'}`}>{value}</dd>
    </div>
  );
}

function formatInterval(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))} h`;
  return `${Math.round(ms / (24 * 60 * 60_000))} dia(s)`;
}

function isRecent(iso: string, ms: number): boolean {
  return Date.now() - new Date(iso).getTime() <= ms;
}
