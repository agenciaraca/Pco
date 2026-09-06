import { lazy, Suspense, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Radio,
  User,
} from 'lucide-react';
import { useMyLiveSessions } from '../data/hooks';
import { useAuth } from '../auth/AuthContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import LiveCaptions from '../components/LiveCaptions';
import { SemConexao, FalhaAoCarregar } from '../components/EstadosDeConsulta';

const ZoomEmbed = lazy(() => import('../components/ZoomEmbed'));

export default function EventoDetail() {
  const { id } = useParams<{ id: string }>();
  useDocumentMeta({ title: 'Sessao ao vivo — AVA PCO' });
  const { user } = useAuth();
  const sessionsQ = useMyLiveSessions();
  const sessions = sessionsQ.data ?? [];
  const session = sessions.find((s) => s.id === id);
  const [showCaptions, setShowCaptions] = useState(false);

  // Sem rede não é "o evento não existe": a tela dizia que ele não existia ou
  // que o aluno não tinha acesso, e as duas coisas mandam procurar a
  // secretaria por um problema que era do celular dele.
  if (sessionsQ.fetchStatus === 'paused') return <SemConexao oQue="este evento" />;
  if (sessionsQ.isPending) return <CardListSkeleton count={1} />;
  if (sessionsQ.isError)
    return (
      <FalhaAoCarregar
        erro={sessionsQ.error}
        oQue="este evento"
        aoTentarDeNovo={() => void sessionsQ.refetch()}
      />
    );
  if (!session) {
    return (
      <div className="space-y-4">
        <Link
          to="/eventos"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar aos eventos
        </Link>
        <EmptyState title="Sessao nao encontrada" description="Este evento nao existe ou voce nao tem acesso." />
      </div>
    );
  }

  const isLive = session.statusComputed === 'live';
  const isScheduled = session.statusComputed === 'scheduled';
  const canEmbed =
    session.embedType === 'zoom_embed' &&
    session.zoomMeetingNumber &&
    (isLive || isScheduled);

  const startDate = new Date(session.startAt);
  const endDate = new Date(startDate.getTime() + session.durationMinutes * 60_000);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        to="/eventos"
        className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
      >
        <ArrowLeft size={11} strokeWidth={2} />
        Voltar aos eventos
      </Link>

      <header className="pco-card p-6">
        <div className="flex items-start gap-3 flex-wrap">
          <div
            className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
              isLive
                ? 'bg-status-success/10 text-status-success'
                : 'bg-pco-blue/10 text-pco-blue'
            }`}
          >
            <Radio size={18} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-pco-deep">{session.title}</h1>
              <span
                className={`pco-badge text-xs ${
                  isLive
                    ? 'bg-status-success/10 text-status-success'
                    : isScheduled
                      ? 'bg-pco-blue/10 text-pco-blue'
                      : 'bg-surface-mute text-ink-muted'
                }`}
              >
                {isLive ? 'AO VIVO' : isScheduled ? 'Agendado' : session.statusComputed}
              </span>
            </div>
            {session.description && (
              <p className="text-sm text-ink-muted">{session.description}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {startDate.toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {startDate.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' — '}
                {endDate.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {` (${session.durationMinutes} min)`}
              </span>
              {session.hostName && (
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {session.hostName}
                </span>
              )}
            </div>
          </div>
        </div>

        {!canEmbed && (isLive || isScheduled) && (
          <div className="mt-4">
            <a
              href={session.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pco-btn-primary text-sm inline-flex items-center gap-2"
            >
              {isLive ? 'Entrar agora' : 'Acessar link'}
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </header>

      {canEmbed && (
        <section>
          <Suspense
            fallback={
              <div className="pco-card p-8 text-center text-sm text-ink-muted">
                Carregando Zoom SDK...
              </div>
            }
          >
            <ZoomEmbed
              meetingNumber={session.zoomMeetingNumber!}
              password={session.zoomPassword}
              userName={user?.name ?? user?.email ?? 'Aluno'}
            />
          </Suspense>
          <p className="text-xs text-ink-subtle mt-2 text-center">
            Problemas com o embed?{' '}
            <a
              href={session.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pco-blue hover:underline"
            >
              Abrir no Zoom diretamente
            </a>
          </p>
        </section>
      )}

      {(isLive || session.statusComputed === 'ended') && id && (
        <LiveCaptions
          sessionId={id}
          visible={showCaptions}
          onToggle={() => setShowCaptions((v) => !v)}
        />
      )}

      {session.statusComputed === 'ended' && (
        <div className="pco-card p-6 text-center space-y-3">
          <p className="text-sm text-ink-muted">Esta sessao ja foi encerrada.</p>
          <Link
            to={`/eventos/${id}/transcript`}
            className="pco-btn-secondary text-xs inline-flex items-center gap-1"
          >
            <FileText size={12} />
            Ver transcricao
          </Link>
        </div>
      )}
    </div>
  );
}
