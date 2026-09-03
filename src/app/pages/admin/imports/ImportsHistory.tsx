import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Filter,
  History as HistoryIcon,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useImportJobs, useRollbackImportJob } from '../../../data/hooks';
import { downloadImportJob } from '../../../data/api';
import { useToast } from '../../../components/Toast';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';
import type { ImportJobsFilterDto, ImportJobDto } from '../../../data/api';

const STATUS_OPTIONS = [
  { value: '', label: 'Qualquer status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'running', label: 'Rodando' },
  { value: 'completed', label: 'Concluído' },
  { value: 'completed_with_errors', label: 'Com erros' },
  { value: 'failed', label: 'Falhou' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'rolled_back', label: 'Rollback' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Qualquer origem' },
  { value: 'csv', label: 'CSV' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'learndash', label: 'LearnDash' },
  { value: 'woocommerce', label: 'WooCommerce' },
];

const MODE_OPTIONS = [
  { value: '', label: 'Qualquer modo' },
  { value: 'csv', label: 'CSV' },
  { value: 'api', label: 'API' },
];

const DRYRUN_OPTIONS = [
  { value: '', label: 'Dry-run e Real' },
  { value: 'true', label: 'Apenas dry-run' },
  { value: 'false', label: 'Apenas execução real' },
];

export default function ImportsHistory() {
  useDocumentMeta({ title: 'Histórico de importações — Admin' });
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [mode, setMode] = useState('');
  const [dryRun, setDryRun] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');

  const filter = useMemo<ImportJobsFilterDto>(() => {
    const f: ImportJobsFilterDto = { limit: 200 };
    if (status) f.status = status;
    if (source) f.source = source;
    if (mode) f.mode = mode;
    if (dryRun === 'true') f.dryRun = true;
    if (dryRun === 'false') f.dryRun = false;
    if (dateFrom) f.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) {
      const dt = new Date(dateTo);
      dt.setHours(23, 59, 59, 999);
      f.dateTo = dt.toISOString();
    }
    if (q.trim()) f.q = q.trim();
    return f;
  }, [status, source, mode, dryRun, dateFrom, dateTo, q]);

  const jobs = useImportJobs(filter);
  const rows = jobs.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/admin/imports"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep mt-1 flex items-center gap-2">
          <HistoryIcon size={20} className="text-pco-blue" strokeWidth={1.75} />
          Histórico de importações
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Filtre, audite, exporte e (com cuidado) reverta jobs.
        </p>
      </header>

      <section className="pco-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
          <Filter size={14} className="text-pco-blue" strokeWidth={1.75} />
          Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} label="Status" />
          <Select value={source} onChange={setSource} options={SOURCE_OPTIONS} label="Origem" />
          <Select value={mode} onChange={setMode} options={MODE_OPTIONS} label="Modo" />
          <Select value={dryRun} onChange={setDryRun} options={DRYRUN_OPTIONS} label="Tipo" />
          <DateInput value={dateFrom} onChange={setDateFrom} label="De" />
          <DateInput value={dateTo} onChange={setDateTo} label="Até" />
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Busca (id ou usuário)
            </span>
            <div className="relative mt-1">
              <Search
                size={12}
                strokeWidth={2}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="imp-... ou e-mail"
                className="pco-input text-sm pl-7 w-full"
              />
            </div>
          </label>
        </div>
      </section>

      <section className="pco-card p-0 overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-b border-pco-border">
          <span className="text-sm font-semibold text-pco-deep">
            {jobs.isLoading ? 'Carregando...' : `${rows.length} job(s)`}
          </span>
        </div>
        {!jobs.isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-ink-muted">
            Nenhum job para os filtros selecionados.
          </div>
        )}
        <ul className="divide-y divide-pco-border">
          {rows.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pco-input mt-1 text-sm w-full"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pco-input mt-1 text-sm w-full"
      />
    </label>
  );
}

function JobRow({ job }: { job: ImportJobDto }) {
  const toast = useToast();
  const rollback = useRollbackImportJob();

  async function handleExport(format: 'csv' | 'json') {
    try {
      await downloadImportJob(job.id, format);
      toast.success(`Relatório ${format.toUpperCase()} baixado`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleRollback() {
    const ok = confirm(
      `Reverter job ${job.id}?\n\n` +
        `• Remove ${job.createdRefs.length} referência(s) externa(s).\n` +
        `• Desativa ${job.createdRefs.filter((r) => r.entity === 'product').length} produto(s).\n` +
        `• Não exclui alunos, matrículas ou histórico de pedidos.\n\n` +
        `Status final: rolled_back.`,
    );
    if (!ok) return;
    rollback.mutate(job.id, {
      onSuccess: (r) => {
        toast.success(
          `Rollback concluído`,
          `${r.refsRemoved} refs removidas, ${r.productsDeactivated} produtos desativados`,
        );
      },
      onError: (err) =>
        toast.error('Falha no rollback', err instanceof Error ? err.message : 'Erro'),
    });
  }

  const canRollback =
    !job.dryRun &&
    job.status !== 'rolled_back' &&
    job.status !== 'pending' &&
    job.status !== 'running';

  return (
    <li className="p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[260px]">
        <Link
          to={`/admin/imports/jobs/${job.id}`}
          className="text-sm font-semibold text-pco-deep hover:text-pco-blue hover:underline inline-flex items-center gap-2 flex-wrap"
        >
          <span>{job.id}</span>
          <StatusBadge status={job.status} />
          {job.dryRun && (
            <span className="pco-badge bg-pco-orange/10 text-pco-orange">dry-run</span>
          )}
          <span className="pco-badge bg-pco-cyan/10 text-pco-cyan">{job.source}</span>
        </Link>
        <div className="mt-0.5 text-xs text-ink-subtle">
          {new Date(job.startedAt).toLocaleString('pt-BR')} · por {job.startedBy}
        </div>
        <div className="mt-1 text-xs text-ink-muted">
          {job.stats.totalRead} lidos · {job.stats.created} criados · {job.stats.updated}{' '}
          atualizados · {job.stats.errors} erros · {(job.stats.durationMs / 1000).toFixed(1)}s
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleExport('csv')}
          className="pco-btn-ghost text-xs"
          title="Exportar CSV"
        >
          <Download size={11} strokeWidth={2} /> CSV
        </button>
        <button
          type="button"
          onClick={() => handleExport('json')}
          className="pco-btn-ghost text-xs"
          title="Exportar JSON"
        >
          <Download size={11} strokeWidth={2} /> JSON
        </button>
        {canRollback && (
          <button
            type="button"
            onClick={handleRollback}
            disabled={rollback.isPending}
            className="pco-btn-ghost text-xs text-status-danger"
            title="Reverter este job (best-effort)"
          >
            <RotateCcw size={11} strokeWidth={2} />
            {rollback.isPending ? 'Revertendo...' : 'Rollback'}
          </button>
        )}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-surface-gray text-ink-muted',
    running: 'bg-pco-blue/10 text-pco-blue',
    completed: 'bg-status-success/10 text-status-success',
    completed_with_errors: 'bg-pco-orange/10 text-pco-orange',
    failed: 'bg-status-danger/15 text-status-danger',
    canceled: 'bg-surface-gray text-ink-muted',
    rolled_back: 'bg-pco-cyan/15 text-pco-cyan',
  };
  return (
    <span className={`pco-badge ${map[status] ?? 'bg-surface-gray text-ink-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
