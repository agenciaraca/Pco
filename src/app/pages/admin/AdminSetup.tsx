import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { useSetupStatus } from '../../data/hooks';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

export default function AdminSetup() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.setup')} — Admin` });
  const setupQ = useSetupStatus();
  const data = setupQ.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <ListChecks size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.setup')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Checklist do que precisa estar configurado para a plataforma rodar 100%.
        </p>
      </header>

      {setupQ.fetchStatus === 'paused' ? (
        <SemConexao oQue="o estado da instalação" />
      ) : setupQ.isError ? (
        <FalhaAoCarregar
          erro={setupQ.error}
          oQue="o estado da instalação"
          aoTentarDeNovo={() => void setupQ.refetch()}
        />
      ) : setupQ.isPending || !data ? (
        <div className="text-sm text-ink-muted">Carregando...</div>
      ) : (
        <>
          <div
            className={`pco-card p-5 border-2 ${
              data.progressPct === 100
                ? 'border-status-success/40 bg-status-success/5'
                : data.progressPct >= 60
                  ? 'border-pco-blue/30'
                  : 'border-pco-orange/40 bg-pco-orange/5'
            }`}
          >
            <div className="flex items-center gap-3">
              {data.progressPct === 100 ? (
                <Sparkles size={28} className="text-status-success" strokeWidth={1.75} />
              ) : (
                <ListChecks size={28} className="text-pco-blue" strokeWidth={1.75} />
              )}
              <div className="flex-1">
                <div className="text-xs uppercase text-ink-subtle">Progresso geral</div>
                <div className="text-2xl font-bold text-pco-deep">
                  {data.ok} de {data.total} prontos · {data.progressPct}%
                </div>
              </div>
              <span
                className={`pco-badge text-base px-3 py-1 ${
                  data.progressPct === 100
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-pco-blue/10 text-pco-blue'
                }`}
              >
                {data.progressPct}%
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-surface-gray overflow-hidden">
              <div
                className={`h-full ${
                  data.progressPct === 100
                    ? 'bg-status-success'
                    : 'bg-gradient-to-r from-pco-blue to-pco-cyan'
                }`}
                style={{ width: `${data.progressPct}%` }}
              />
            </div>
          </div>

          <ul className="space-y-2">
            {data.items.map((item) => (
              <li
                key={item.id}
                className={`pco-card p-4 flex items-center gap-3 ${
                  item.ok
                    ? ''
                    : 'border-pco-orange/40 bg-pco-orange/5'
                }`}
              >
                {item.ok ? (
                  <CheckCircle2
                    size={20}
                    className="text-status-success shrink-0"
                    strokeWidth={1.75}
                  />
                ) : (
                  <AlertCircle
                    size={20}
                    className="text-pco-orange shrink-0"
                    strokeWidth={1.75}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep">{item.label}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{item.message}</div>
                </div>
                <Link
                  to={item.link}
                  className={
                    item.ok ? 'pco-btn-ghost text-xs' : 'pco-btn-primary text-xs'
                  }
                >
                  {item.ok ? 'Revisar' : 'Configurar'}
                  <ArrowRight size={11} strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
