import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useHealthSnapshot } from '../../data/hooks';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { HealthCheckItemDto, HealthStatusDto } from '../../data/api';
import { useT } from '../../i18n';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

const styles: Record<
  HealthStatusDto,
  { card: string; badge: string; label: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    card: 'border-status-success/30',
    badge: 'bg-status-success/10 text-status-success',
    label: 'OK',
    Icon: CheckCircle2,
  },
  warn: {
    card: 'border-pco-orange/40',
    badge: 'bg-pco-orange/10 text-pco-orange',
    label: 'Atenção',
    Icon: AlertTriangle,
  },
  error: {
    card: 'border-status-danger/40',
    badge: 'bg-status-danger/15 text-status-danger',
    label: 'Falha',
    Icon: AlertCircle,
  },
  na: {
    card: 'border-pco-border',
    badge: 'bg-surface-gray text-ink-muted',
    label: 'N/A',
    Icon: Activity,
  },
};

export default function AdminSaude() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.health')} — Admin AVA PCO` });
  const q = useHealthSnapshot();
  const { data, refetch, isFetching } = q;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Activity size={20} className="text-pco-blue" strokeWidth={1.75} />
            {t('admin.nav.health')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Visão geral em tempo real de todos os módulos críticos do AVA. Atualiza a cada
            60s.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="pco-btn-ghost text-xs"
        >
          <RefreshCw size={11} strokeWidth={2} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Atualizando...' : 'Atualizar agora'}
        </button>
      </header>

      {q.fetchStatus === 'paused' ? (
        <SemConexao oQue="o estado dos módulos" />
      ) : q.isPending ? (
        <div className="text-sm text-ink-muted">Carregando...</div>
      ) : q.isError || !data ? (
        // Esta tela já distinguia a falha — era a única das três —, mas dizia
        // só "Falha ao buscar status.", sem o motivo e sem como tentar de novo.
        // Numa tela de saúde, o motivo é o conteúdo.
        <FalhaAoCarregar
          erro={q.error}
          oQue="o estado dos módulos"
          aoTentarDeNovo={() => void refetch()}
        />
      ) : (
        <>
          <div className={`pco-card p-4 border-2 ${styles[data.overall].card}`}>
            <div className="flex items-center gap-3">
              {(() => {
                const I = styles[data.overall].Icon;
                return <I size={28} className="text-pco-deep" strokeWidth={1.75} />;
              })()}
              <div>
                <div className="text-xs text-ink-muted">Status geral</div>
                <div className="text-2xl font-bold text-pco-deep">
                  {data.overall === 'ok'
                    ? 'Tudo operacional'
                    : data.overall === 'warn'
                      ? 'Atenção em alguns módulos'
                      : 'Falha crítica'}
                </div>
                <div className="text-xs text-ink-subtle mt-1">
                  Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}
                </div>
              </div>
              <span
                className={`pco-badge ml-auto text-base px-3 py-1 ${styles[data.overall].badge}`}
              >
                {styles[data.overall].label}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.checks.map((c) => (
              <CheckCard key={c.id} check={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CheckCard({ check }: { check: HealthCheckItemDto }) {
  const s = styles[check.status];
  const Icon = s.Icon;
  return (
    <div className={`pco-card p-4 border ${s.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
          <Icon size={14} strokeWidth={1.75} />
          {check.label}
        </div>
        <span className={`pco-badge ${s.badge}`}>{s.label}</span>
      </div>
      <p className="mt-2 text-xs text-ink-muted">{check.message}</p>
      {check.metric !== undefined && (
        <div className="mt-2 text-xl font-bold text-pco-deep">
          {String(check.metric)}
        </div>
      )}
    </div>
  );
}
