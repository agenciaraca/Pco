import { Cog, Play, CheckCircle2, AlertCircle, Clock, RefreshCw, Minus } from 'lucide-react';
import { useJobs, useRunJob } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import type { JobStatusDto } from '../../data/api';

/**
 * Os workers que rodam dentro do servidor.
 *
 * Esta tela mostrava **cinco de doze** — os outros sete não apareciam em lugar
 * nenhum do produto, entre eles o backup, a rotação de log e o sondador da
 * Sandra, que é o único confirmador de pagamento daquele gateway. A lista agora
 * vem de `server/jobs/inventario.ts`, e `test/jobs-inventario.test.ts` compara
 * essa lista com os `startWorker` do boot.
 */
export default function AdminJobs() {
  useDocumentMeta({ title: 'Jobs / Workers — Admin' });
  const jobsQ = useJobs();
  const runMut = useRunJob();
  const toast = useToast();

  const jobs = jobsQ.data?.jobs ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Cog size={20} className="text-pco-blue" strokeWidth={1.75} />
          Jobs &amp; workers em background
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Todos os workers que o servidor mantém em loop. Refresh automático a cada 10s.
          {jobs.length > 0 && (
            <>
              {' '}
              <strong className="text-pco-deep">{jobs.length}</strong> no ar.
            </>
          )}
        </p>
      </header>

      {/* Sem rede não é "nenhum worker": era o ramo que faltava. */}
      {jobsQ.fetchStatus === 'paused' ? (
        <SemConexao oQue="os workers" />
      ) : jobsQ.isPending ? (
        <CardListSkeleton count={4} />
      ) : jobsQ.isError ? (
        <FalhaAoCarregar
          erro={jobsQ.error}
          oQue="os workers"
          aoTentarDeNovo={() => void jobsQ.refetch()}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <JobCard
              key={job.name}
              job={job}
              onRun={async (dryRun) => {
                try {
                  await runMut.mutateAsync({ name: job.name, dryRun });
                  toast.success(`${job.rotulo} executado`);
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

/** Jobs cujo "rodar agora" aceita ensaio. Ver `POST /admin/jobs/:name/run`. */
const COM_ENSAIO = new Set(['reengagement', 'access-expiry', 'session-reminders']);

function JobCard({
  job,
  onRun,
  isPending,
}: {
  job: JobStatusDto;
  onRun: (dryRun: boolean) => void;
  isPending: boolean;
}) {
  const atrasado =
    job.enabled && job.lastRunAt !== null && !recente(job.lastRunAt, job.intervalMs * 3);

  return (
    <div className="pco-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-pco-deep">{job.rotulo}</h3>
          <p className="text-[11px] font-mono text-ink-subtle">{job.name}</p>
        </div>
        <SeloDeSaude job={job} />
      </div>

      <p className="text-xs text-ink-muted leading-relaxed">{job.descricao}</p>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Intervalo" value={formatarIntervalo(job.intervalMs)} />
        <Stat
          label="Última execução"
          value={
            job.lastRunAt ? new Date(job.lastRunAt).toLocaleString('pt-BR') : '— ainda não rodou —'
          }
        />
        {/*
          Travessão, não "undefined". Worker que não conta ticks não tem zero
          ticks — ele não conta, e são coisas diferentes.
        */}
        <Stat label="Ticks" value={job.totalTicks === null ? '—' : String(job.totalTicks)} />
        {Object.entries(job.detalhes)
          .filter(([, v]) => typeof v === 'number' || typeof v === 'boolean')
          .filter(([k]) => !CHAVES_JA_MOSTRADAS.has(k))
          .slice(0, 5)
          .map(([k, v]) => (
            <Stat
              key={k}
              label={rotuloDoDetalhe(k)}
              value={typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)}
              color={
                /erro|falha/i.test(k) && typeof v === 'number' && v > 0
                  ? 'text-status-danger'
                  : undefined
              }
            />
          ))}
      </dl>

      {atrasado && (
        <div className="text-xs text-pco-orange flex items-center gap-1">
          <Clock size={11} strokeWidth={1.75} />
          Última execução foi há mais de {formatarIntervalo(job.intervalMs * 3)}.
        </div>
      )}

      {job.podeRodarAgora && (
        <div className="flex gap-2 justify-end">
          {COM_ENSAIO.has(job.name) && (
            <button
              type="button"
              onClick={() => onRun(true)}
              disabled={isPending}
              className="pco-btn-ghost text-xs"
            >
              <RefreshCw size={11} strokeWidth={2} />
              Ensaiar
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
      )}
    </div>
  );
}

/**
 * Três estados, não dois.
 *
 * `saudavel: null` é **não medido** — a maioria dos workers não sabe dizer da
 * própria saúde, e pintá-los de verde seria afirmar o que ninguém apurou. Só o
 * dos webhooks, o do backup e o da Sandra respondem de verdade.
 */
function SeloDeSaude({ job }: { job: JobStatusDto }) {
  if (!job.enabled) {
    return (
      <span className="pco-badge bg-status-danger/15 text-status-danger shrink-0">
        <AlertCircle size={10} strokeWidth={2} />
        parado
      </span>
    );
  }
  if (job.saudavel === false) {
    return (
      <span className="pco-badge bg-status-danger/15 text-status-danger shrink-0">
        <AlertCircle size={10} strokeWidth={2} />
        com falha
      </span>
    );
  }
  if (job.saudavel === true) {
    return (
      <span className="pco-badge bg-status-success/10 text-status-success shrink-0">
        <CheckCircle2 size={10} strokeWidth={2} />
        saudável
      </span>
    );
  }
  return (
    <span
      className="pco-badge bg-surface-gray text-ink-muted shrink-0"
      title="Este worker não reporta saúde própria — está no ar, e é só o que se sabe."
    >
      <Minus size={10} strokeWidth={2} />
      no ar
    </span>
  );
}

/** O que o card já mostra em campo próprio, para não repetir em `detalhes`. */
const CHAVES_JA_MOSTRADAS = new Set([
  'enabled',
  'intervalMs',
  'totalTicks',
  'lastRunAt',
  'lastTickAt',
  'lastRotatedAt',
  'ultimaExecucao',
  'saudavel',
  'bancoCoberto',
]);

const ROTULOS: Record<string, string> = {
  pending: 'Pendentes',
  totalDeliveries: 'Total entregas',
  recentEmails24h: 'E-mails 24h',
  running: 'Rodando agora',
  falhasAoEnfileirar: 'Falhas ao enfileirar',
  falhasSeguidas: 'Falhas seguidas',
  confirmados: 'Confirmados',
  pendentesVistos: 'Cobranças vistas',
  erros: 'Erros',
  totalDispatched: 'Disparadas',
  totalUpdated: 'Atualizados',
  totalRotations: 'Rotações',
  keepDays: 'Dias mantidos',
  tabelasEsperadas: 'Tabelas do banco',
  avisosLigados: 'Avisos ligados',
};

function rotuloDoDetalhe(chave: string): string {
  return ROTULOS[chave] ?? chave;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-ink-subtle">{label}</dt>
      <dd className={`font-semibold ${color ?? 'text-pco-deep'}`}>{value}</dd>
    </div>
  );
}

function formatarIntervalo(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))} h`;
  return `${Math.round(ms / (24 * 60 * 60_000))} dia(s)`;
}

function recente(iso: string, ms: number): boolean {
  return Date.now() - new Date(iso).getTime() <= ms;
}
