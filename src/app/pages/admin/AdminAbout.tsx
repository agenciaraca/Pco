import {
  Info,
  Server,
  GitBranch,
  Clock,
  Cpu,
  ExternalLink,
  RefreshCcw,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminAbout } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export default function AdminAbout() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.about')} — Admin AVA PCO` });
  const aboutQ = useAdminAbout();
  const data = aboutQ.data;
  const qc = useQueryClient();
  const toast = useToast();

  function handleInvalidateAll() {
    if (
      !confirm(
        'Forçar refresh de todos os dados em cache?\n\nNão afeta o servidor — apenas o navegador refaz queries.',
      )
    )
      return;
    qc.invalidateQueries();
    toast.success('Caches invalidados — recarregando dados');
  }

  /*
    Sem rede a consulta fica `paused`, e nesse estado `isLoading` e `isError`
    são os dois `false` — a tela caía no ramo seguinte e dizia que não havia
    nada. No painel o custo é menor do que na tela do aluno, mas a leitura é a
    mesma: quem vê "nenhum registro" para de procurar.
  */
  if (aboutQ.fetchStatus === 'paused') return <SemConexao oQue="a página Sobre" />;
  if (aboutQ.isError)
    return (
      <FalhaAoCarregar
        erro={aboutQ.error}
        oQue="a página Sobre"
        aoTentarDeNovo={() => void aboutQ.refetch()}
      />
    );
  if (aboutQ.isPending || !data) return <CardListSkeleton count={3} />;

  const rows: Array<{ label: string; value: string; icon?: React.ReactNode }> = [
    { label: 'Versão', value: `v${data.version}`, icon: <Info size={14} /> },
    { label: 'Ambiente', value: data.env },
    {
      label: 'Commit',
      value: data.commit ? data.commit.slice(0, 8) : '—',
      icon: <GitBranch size={14} />,
    },
    {
      label: 'Build em',
      value: data.buildDate
        ? new Date(data.buildDate).toLocaleString('pt-BR')
        : '—',
    },
    { label: 'Node', value: data.nodeVersion, icon: <Cpu size={14} /> },
    {
      label: 'Uptime',
      value: formatUptime(data.uptimeSeconds),
      icon: <Clock size={14} />,
    },
    {
      label: 'Memória RSS',
      value: `${data.memoryMB} MB`,
    },
    { label: 'PID', value: String(data.pid) },
    {
      label: 'Hostname',
      value: data.hostname ?? '—',
      icon: <Server size={14} />,
    },
    {
      label: 'DATA_DIR override',
      value: data.dataDirOverride ? 'sim' : 'não',
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Info size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.about')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Informações de build e estado do servidor.
        </p>
      </header>

      <div className="pco-card overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-surface-mute">
            {rows.map((r) => (
              <tr key={r.label} className="hover:bg-surface-mute/40">
                <td className="px-4 py-2.5 text-ink-muted w-48">
                  <div className="flex items-center gap-2">
                    {r.icon && <span className="text-ink-subtle">{r.icon}</span>}
                    {r.label}
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-pco-deep">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="pco-card p-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-pco-deep">Cache do cliente</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Se notar dados desatualizados, force um refresh completo das queries.
          </p>
        </div>
        <button
          type="button"
          onClick={handleInvalidateAll}
          className="pco-btn-ghost text-xs"
        >
          <RefreshCcw size={11} strokeWidth={2} />
          Invalidar caches
        </button>
      </section>

      <section className="pco-card p-4">
        <h2 className="text-sm font-semibold text-pco-deep mb-2">Links úteis</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <a
              href="https://github.com/agenciaraca/Pco"
              target="_blank"
              rel="noreferrer"
              className="text-pco-blue hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink size={11} />
              Código-fonte (GitHub)
            </a>
          </li>
          <li>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="text-pco-blue hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink size={11} />
              /api/health
            </a>
          </li>
          <li>
            <a
              href="/api/ready"
              target="_blank"
              rel="noreferrer"
              className="text-pco-blue hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink size={11} />
              /api/ready
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
