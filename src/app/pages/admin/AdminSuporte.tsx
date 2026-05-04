import { useState } from 'react';
import {
  LifeBuoy,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  Filter,
} from 'lucide-react';
import {
  useAllSupportTickets,
  useUpdateSupportStatus,
  useRespondSupport,
  useAdminStudents,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import type { SupportTicket } from '../../types/schema';

const statusStyles: Record<SupportTicket['status'], string> = {
  open: 'bg-pco-orange/10 text-pco-orange',
  in_progress: 'bg-pco-blue/10 text-pco-blue',
  resolved: 'bg-status-success/10 text-status-success',
  closed: 'bg-surface-gray text-ink-muted',
};
const statusLabel: Record<SupportTicket['status'], string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export default function AdminSuporte() {
  const ticketsQ = useAllSupportTickets();
  const studentsQ = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const updateMut = useUpdateSupportStatus();
  const respondMut = useRespondSupport();
  const toast = useToast();

  const [filter, setFilter] = useState<'all' | SupportTicket['status']>('open');
  const [responding, setResponding] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');

  const studentName = (id: string) => studentsQ.data?.find((s) => s.id === id)?.name ?? id;

  const list = (ticketsQ.data ?? []).filter((t) => filter === 'all' || t.status === filter);

  async function handleStatus(
    t: SupportTicket,
    status: 'open' | 'in_progress' | 'resolved',
  ) {
    try {
      await updateMut.mutateAsync({ id: t.id, status });
      toast.success(`Status: ${statusLabel[status]}`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleRespond(t: SupportTicket) {
    if (draftMessage.trim().length < 2) {
      toast.warning('Digite uma resposta');
      return;
    }
    try {
      await respondMut.mutateAsync({ id: t.id, message: draftMessage.trim() });
      toast.success('Resposta enviada');
      setDraftMessage('');
      setResponding(null);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const counts = {
    all: ticketsQ.data?.length ?? 0,
    open: (ticketsQ.data ?? []).filter((t) => t.status === 'open').length,
    in_progress: (ticketsQ.data ?? []).filter((t) => t.status === 'in_progress').length,
    resolved: (ticketsQ.data ?? []).filter((t) => t.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Suporte</h1>
        <p className="pco-section-subtitle mt-1">
          Tickets enviados pelos alunos. Atualize status e responda direto pra notificá-los.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`pco-card text-left transition-colors ${
              filter === s ? 'ring-2 ring-pco-blue' : ''
            }`}
          >
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              {s === 'all' ? 'Todos' : statusLabel[s as SupportTicket['status']]}
            </div>
            <div className="text-2xl font-bold text-pco-deep mt-1">{counts[s]}</div>
          </button>
        ))}
      </div>

      <div className="text-xs text-ink-muted flex items-center gap-1">
        <Filter size={12} strokeWidth={2} />
        Mostrando {list.length} de {counts.all}
      </div>

      {ticketsQ.isLoading ? (
        <CardListSkeleton count={4} />
      ) : ticketsQ.isError ? (
        <ErrorState
          action={
            <button onClick={() => ticketsQ.refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="Nenhum ticket no filtro"
          description="Quando alunos abrirem solicitações, elas aparecem aqui."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((t) => (
            <li key={t.id} className="pco-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <LifeBuoy size={14} className="text-pco-blue mt-1 shrink-0" strokeWidth={2} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-pco-deep">{t.subject}</span>
                      <span className={`pco-badge ${statusStyles[t.status]}`}>
                        {statusLabel[t.status]}
                      </span>
                      <span className="pco-badge bg-surface-mute text-ink-muted">
                        {t.category}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-subtle">
                      de <span className="text-pco-deep">{studentName(t.studentId)}</span> ·
                      criado {new Date(t.createdAt).toLocaleString('pt-BR')}
                    </div>
                    <p className="mt-2 text-sm text-ink-muted whitespace-pre-wrap">
                      {t.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {t.status !== 'in_progress' && (
                    <button
                      className="pco-btn-ghost text-xs"
                      onClick={() => handleStatus(t, 'in_progress')}
                      title="Marcar em andamento"
                    >
                      <Clock size={11} strokeWidth={2} />
                    </button>
                  )}
                  {t.status !== 'resolved' && (
                    <button
                      className="pco-btn-ghost text-xs text-status-success"
                      onClick={() => handleStatus(t, 'resolved')}
                      title="Marcar resolvido"
                    >
                      <CheckCircle2 size={11} strokeWidth={2} />
                    </button>
                  )}
                  <button
                    className="pco-btn-secondary text-xs"
                    onClick={() => {
                      setResponding((cur) => (cur === t.id ? null : t.id));
                      setDraftMessage('');
                    }}
                  >
                    <MessageSquare size={11} strokeWidth={2} />
                    Responder
                  </button>
                </div>
              </div>

              {responding === t.id && (
                <div className="mt-3 border-t border-surface-mute pt-3">
                  <textarea
                    rows={3}
                    placeholder="Mensagem para o aluno (será entregue como notificação in-app)..."
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    className="pco-input resize-none text-sm"
                    maxLength={2000}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setResponding(null)}
                      className="pco-btn-ghost text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleRespond(t)}
                      disabled={respondMut.isPending}
                      className="pco-btn-primary text-xs"
                    >
                      {respondMut.isPending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Send size={11} strokeWidth={2} />
                      )}
                      Enviar resposta
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
