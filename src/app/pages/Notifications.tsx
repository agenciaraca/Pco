import { Bell, AlertCircle, Info, CheckCircle2, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import type { NotificationDto } from '../data/api';
import { useT } from '../i18n';

const categoryStyle: Record<NotificationDto['category'], { color: string; Icon: typeof Bell }> = {
  info: { color: 'text-pco-blue bg-pco-blue/10', Icon: Info },
  success: { color: 'text-status-success bg-status-success/10', Icon: CheckCircle2 },
  warning: { color: 'text-pco-orange bg-pco-orange/10', Icon: AlertCircle },
  danger: { color: 'text-status-danger bg-status-danger/10', Icon: AlertCircle },
  announcement: { color: 'text-status-gold bg-status-gold/10', Icon: Megaphone },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}min atrás`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Notifications() {
  const t = useT();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const toast = useToast();

  async function handleMarkAll() {
    try {
      await markAll.mutateAsync();
      toast.success('Todas marcadas como lidas');
    } catch {
      toast.error('Erro ao marcar');
    }
  }

  function handleClickItem(n: NotificationDto) {
    if (!n.readAt) markOne.mutate(n.id);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('notifications.title')}</h1>
          <p className="pco-section-subtitle mt-1">
            Avisos importantes do seu progresso e do AVA.
          </p>
        </div>
        <button
          className="pco-btn-secondary text-xs"
          onClick={handleMarkAll}
          disabled={markAll.isPending || !data || data.every((n) => n.readAt)}
        >
          {markAll.isPending ? 'Marcando...' : 'Marcar todas como lidas'}
        </button>
      </header>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          action={
            <button className="pco-btn-secondary text-xs" onClick={() => refetch()}>
              Tentar novamente
            </button>
          }
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nenhuma notificação por aqui"
          description="Você ficará sabendo quando houver novas aulas, conquistas ou avisos."
        />
      ) : (
        <div className="pco-card p-0 overflow-hidden">
          <ul className="divide-y divide-surface-gray">
            {data.map((n) => {
              const style = categoryStyle[n.category] ?? categoryStyle.info;
              const Icon = style.Icon;
              const Wrapper = (n.link ? Link : 'div') as React.ElementType;
              const wrapperProps = n.link ? { to: n.link } : {};
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 p-4 hover:bg-surface-off ${
                    !n.readAt ? 'bg-pco-blue/[0.03]' : ''
                  }`}
                  onClick={() => handleClickItem(n)}
                >
                  <div className={`h-9 w-9 rounded-lg grid place-items-center ${style.color}`}>
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                  <Wrapper className="flex-1 min-w-0 cursor-pointer" {...wrapperProps}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-pco-deep">
                        {n.title}
                        {!n.readAt && (
                          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-pco-orange" />
                        )}
                      </div>
                      <div className="text-xs text-ink-subtle shrink-0">
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">{n.body}</p>
                    {n.authorEmail && (
                      <p className="text-xs text-ink-subtle mt-1">de {n.authorEmail}</p>
                    )}
                  </Wrapper>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

