import { Link } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Trash2,
  LifeBuoy,
  MessageSquare,
  UploadCloud,
  Webhook,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useAlertsCenter } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

export default function AdminAlertsCenter() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.alerts')} — Admin` });
  const alertsQ = useAlertsCenter();
  const { data, refetch, isFetching } = alertsQ;

  /*
    Sem rede a consulta fica `paused`, e nesse estado `isLoading` e `isError`
    são os dois `false` — a tela caía no ramo seguinte e dizia que não havia
    nada. No painel o custo é menor do que na tela do aluno, mas a leitura é a
    mesma: quem vê "nenhum registro" para de procurar.
  */
  if (alertsQ.fetchStatus === 'paused') return <SemConexao oQue="os alertas" />;
  if (alertsQ.isError)
    return (
      <FalhaAoCarregar
        erro={alertsQ.error}
        oQue="os alertas"
        aoTentarDeNovo={() => void alertsQ.refetch()}
      />
    );
  if (alertsQ.isPending || !data) return <CardListSkeleton count={5} />;

  const sections = [
    {
      title: 'Saúde do sistema',
      icon: AlertTriangle,
      count: data.health.issues.length,
      severity:
        data.health.overall === 'error'
          ? 'error'
          : data.health.issues.length > 0
            ? 'warn'
            : 'ok',
      link: '/admin/saude',
      items: data.health.issues.slice(0, 5).map((i) => ({
        title: i.label,
        subtitle: i.message,
      })),
    },
    {
      title: 'Tickets de suporte abertos',
      icon: LifeBuoy,
      count: data.supportTicketsOpen.count,
      severity: data.supportTicketsOpen.count > 0 ? 'warn' : 'ok',
      link: '/admin/suporte',
      items: data.supportTicketsOpen.items.map((t) => ({
        title: t.subject,
        subtitle: `Aberto em ${new Date(t.createdAt).toLocaleString('pt-BR')}`,
      })),
    },
    {
      title: 'Solicitações de exclusão (LGPD)',
      icon: Trash2,
      count: data.lgpdDeletionRequests.count,
      severity: data.lgpdDeletionRequests.count > 0 ? 'warn' : 'ok',
      link: '/admin/lgpd-exclusoes',
      items: data.lgpdDeletionRequests.items.map((r) => ({
        title: r.userEmail,
        subtitle: `Solicitado em ${new Date(r.requestedAt).toLocaleString('pt-BR')}`,
      })),
    },
    {
      title: 'Imports falhos',
      icon: UploadCloud,
      count: data.failedImportJobs.count,
      severity: data.failedImportJobs.count > 0 ? 'error' : 'ok',
      link: '/admin/imports/history',
      items: data.failedImportJobs.items.map((j) => ({
        title: `${j.source} · ${j.mode}`,
        subtitle: new Date(j.startedAt).toLocaleString('pt-BR'),
      })),
    },
    {
      title: 'Webhooks falhando',
      icon: Webhook,
      count: data.failedWebhookDeliveries.count,
      severity: data.failedWebhookDeliveries.count > 0 ? 'error' : 'ok',
      link: '/admin/webhooks',
      items: data.failedWebhookDeliveries.items.map((d) => ({
        title: d.event,
        subtitle: `${d.attempts} tentativas — ${new Date(d.createdAt).toLocaleString('pt-BR')}`,
      })),
    },
    {
      title: 'Comentários moderados',
      icon: MessageSquare,
      count: data.moderatedComments.count,
      severity: 'info',
      link: '/admin/moderacao',
      items: data.moderatedComments.recent.map((c) => ({
        title: c.authorName,
        subtitle: new Date(c.createdAt).toLocaleString('pt-BR'),
      })),
    },
  ];

  const totalAlerts = sections
    .filter((s) => s.severity === 'warn' || s.severity === 'error')
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Bell size={20} className="text-pco-blue" strokeWidth={1.75} />
            {t('admin.nav.alerts')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Tudo que precisa atenção em um só lugar — atualizado a cada minuto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="pco-btn-ghost text-xs"
        >
          <RefreshCw
            size={11}
            strokeWidth={2}
            className={isFetching ? 'animate-spin' : ''}
          />
          Atualizar
        </button>
      </header>

      <div
        className={`pco-card p-4 ${
          totalAlerts === 0
            ? 'border-status-success/30 bg-status-success/5'
            : 'border-pco-orange/30 bg-pco-orange/5'
        }`}
      >
        <div className="flex items-center gap-3">
          {totalAlerts === 0 ? (
            <span className="text-2xl">✅</span>
          ) : (
            <AlertCircle size={24} className="text-pco-orange shrink-0" />
          )}
          <div>
            <div className="text-sm font-semibold text-pco-deep">
              {totalAlerts === 0
                ? 'Tudo certo'
                : `${totalAlerts} item(ns) pedem atenção`}
            </div>
            <div className="text-xs text-ink-muted">
              Última verificação:{' '}
              {new Date(data.generatedAt).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const colorClass =
            section.severity === 'error'
              ? 'border-status-danger/30 text-status-danger'
              : section.severity === 'warn'
                ? 'border-pco-orange/30 text-pco-orange'
                : section.severity === 'info'
                  ? 'border-pco-blue/30 text-pco-blue'
                  : 'border-pco-border text-ink-muted';
          return (
            <Link
              key={section.title}
              to={section.link}
              className={`pco-card pco-card-hover p-4 ${colorClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon size={16} strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-pco-deep">
                    {section.title}
                  </h3>
                </div>
                <span className="text-xl font-bold">{section.count}</span>
              </div>
              {section.items.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {section.items.map((it, i) => (
                    <li
                      key={i}
                      className="text-xs text-ink-muted border-l-2 border-pco-border pl-2"
                    >
                      <div className="font-semibold text-pco-deep truncate">
                        {it.title}
                      </div>
                      <div className="text-ink-subtle truncate">{it.subtitle}</div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 text-xs text-pco-blue inline-flex items-center gap-0.5">
                Ver detalhes
                <ChevronRight size={10} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
