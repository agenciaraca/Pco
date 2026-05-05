import { useMemo, useState } from 'react';
import {
  LifeBuoy,
  Search,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import {
  useAllSupportTickets,
  useUpdateSupportStatus,
  useRespondSupport,
  useAdminStudents,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { SupportTicket } from '../../types/schema';

const STATUS_LABELS: Record<SupportTicket['status'], string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const STATUS_STYLE: Record<SupportTicket['status'], string> = {
  open: 'bg-pco-orange/10 text-pco-orange',
  in_progress: 'bg-pco-blue/10 text-pco-blue',
  resolved: 'bg-status-success/10 text-status-success',
  closed: 'bg-surface-gray text-ink-muted',
};

const CATEGORY_LABELS: Record<SupportTicket['category'], string> = {
  duvida_aula: 'Dúvida sobre aula',
  acesso: 'Acesso',
  certificado: 'Certificado',
  tutor: 'Tutor Virtual',
  biblioteca: 'Biblioteca',
  outro: 'Outro',
};

export default function AdminSupport() {
  useDocumentMeta({ title: 'Suporte — Admin AVA PCO' });
  const tickets = useAllSupportTickets();
  const students = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const updateStatus = useUpdateSupportStatus();
  const respondMut = useRespondSupport();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<
    SupportTicket['status'] | 'all'
  >('open');
  const [search, setSearch] = useState('');
  const [responding, setResponding] = useState<SupportTicket | null>(null);

  const studentMap = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, s])),
    [students.data],
  );

  const visible = useMemo(() => {
    const list = tickets.data ?? [];
    return list.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const student = studentMap.get(t.studentId);
        const hay = `${t.subject} ${t.message} ${student?.name ?? ''} ${
          student?.email ?? ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets.data, statusFilter, search, studentMap]);

  const counts = useMemo(() => {
    const list = tickets.data ?? [];
    return {
      open: list.filter((t) => t.status === 'open').length,
      in_progress: list.filter((t) => t.status === 'in_progress').length,
      resolved: list.filter((t) => t.status === 'resolved').length,
      total: list.length,
    };
  }, [tickets.data]);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <LifeBuoy size={20} className="text-pco-blue" strokeWidth={1.75} />
          Suporte aos alunos
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Tickets abertos pelos alunos. Responda e mude status; aluno é
          notificado in-app.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard
          label="Abertos"
          value={counts.open}
          icon={<AlertCircle size={14} className="text-pco-orange" />}
        />
        <KpiCard
          label="Em andamento"
          value={counts.in_progress}
          icon={<Clock size={14} className="text-pco-blue" />}
        />
        <KpiCard
          label="Resolvidos"
          value={counts.resolved}
          icon={<CheckCircle2 size={14} className="text-status-success" />}
        />
        <KpiCard
          label="Total"
          value={counts.total}
          icon={<LifeBuoy size={14} className="text-ink-muted" />}
        />
      </div>

      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por aluno, email ou conteúdo..."
            className="pco-input text-sm flex-1"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as SupportTicket['status'] | 'all',
            )
          }
          className="pco-input text-sm"
        >
          <option value="all">Todos status</option>
          <option value="open">Abertos</option>
          <option value="in_progress">Em andamento</option>
          <option value="resolved">Resolvidos</option>
          <option value="closed">Fechados</option>
        </select>
      </div>

      {tickets.isLoading ? (
        <CardListSkeleton count={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={search || statusFilter !== 'all' ? 'Nenhum resultado' : 'Sem tickets'}
          description={
            search || statusFilter !== 'all'
              ? 'Ajuste os filtros.'
              : 'Os tickets abertos pelos alunos aparecerão aqui.'
          }
          icon={<LifeBuoy size={28} className="text-pco-blue" />}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => {
            const student = studentMap.get(t.studentId);
            return (
              <li key={t.id} className="pco-card p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`pco-badge text-[10px] ${STATUS_STYLE[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                      <span className="pco-badge text-[10px] bg-pco-blue/10 text-pco-blue">
                        {CATEGORY_LABELS[t.category]}
                      </span>
                      <span className="text-[11px] text-ink-subtle">
                        {new Date(t.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-pco-deep mt-1">
                      {t.subject}
                    </h3>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      Por: <strong>{student?.name ?? '?'}</strong>{' '}
                      <span className="text-ink-subtle">{student?.email}</span>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted whitespace-pre-wrap bg-surface-mute p-2 rounded">
                      {t.message}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {t.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => setResponding(t)}
                        className="pco-btn-primary text-xs"
                      >
                        <Send size={11} strokeWidth={2} />
                        Responder
                      </button>
                    )}
                    <select
                      value={t.status === 'closed' ? 'resolved' : t.status}
                      onChange={async (e) => {
                        try {
                          await updateStatus.mutateAsync({
                            id: t.id,
                            status: e.target.value as
                              | 'open'
                              | 'in_progress'
                              | 'resolved',
                          });
                          toast.success('Status atualizado');
                        } catch (err) {
                          toast.error(
                            'Falha',
                            err instanceof Error ? err.message : 'Erro',
                          );
                        }
                      }}
                      className="pco-input text-xs"
                    >
                      <option value="open">Aberto</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="resolved">Resolvido</option>
                    </select>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {responding && (
        <RespondModal
          ticket={responding}
          onClose={() => setResponding(null)}
          onSubmit={async (message) => {
            try {
              await respondMut.mutateAsync({ id: responding.id, message });
              toast.success('Resposta enviada');
              setResponding(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
          isPending={respondMut.isPending}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="pco-card p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-pco-deep mt-1">{value}</div>
    </div>
  );
}

function RespondModal({
  ticket,
  onClose,
  onSubmit,
  isPending,
}: {
  ticket: SupportTicket;
  onClose: () => void;
  onSubmit: (message: string) => void;
  isPending: boolean;
}) {
  const [message, setMessage] = useState('');
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="pco-card w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-pco-deep">Responder ticket</h2>
          <button
            type="button"
            onClick={onClose}
            className="pco-btn-ghost text-xs"
          >
            <X size={11} strokeWidth={2} />
          </button>
        </div>

        <div className="text-xs text-ink-muted bg-surface-mute p-2 rounded">
          <div className="font-semibold text-pco-deep">{ticket.subject}</div>
          <div className="mt-1 whitespace-pre-wrap">{ticket.message}</div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder="Sua resposta — será enviada como notificação in-app ao aluno..."
          className="pco-input text-sm w-full"
        />
        <p className="text-[11px] text-ink-subtle">
          Após enviar, o ticket muda automaticamente para 'Em andamento'.
        </p>

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} className="pco-btn-ghost text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSubmit(message)}
            disabled={isPending || message.trim().length < 2}
            className="pco-btn-primary"
          >
            {isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} strokeWidth={2} />
            )}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
