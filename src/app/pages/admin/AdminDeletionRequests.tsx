import { useMemo, useState } from 'react';
import {
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  Clock,
} from 'lucide-react';
import {
  useAdminDeletionRequests,
  useUpdateAdminDeletionRequest,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { DeletionRequestDto, DeletionStatusDto } from '../../data/api';

const STATUS_LABELS: Record<DeletionStatusDto, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  completed: 'Concluída',
};

const STATUS_STYLE: Record<DeletionStatusDto, string> = {
  pending: 'bg-pco-orange/10 text-pco-orange',
  approved: 'bg-pco-blue/10 text-pco-blue',
  rejected: 'bg-surface-gray text-ink-muted',
  completed: 'bg-status-success/10 text-status-success',
};

export default function AdminDeletionRequests() {
  useDocumentMeta({ title: 'Exclusões de conta — Admin' });
  const list = useAdminDeletionRequests();
  const updateMut = useUpdateAdminDeletionRequest();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<DeletionStatusDto | 'all'>(
    'pending',
  );
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return (list.data ?? []).filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.userEmail.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list.data, statusFilter, search]);

  async function handleAction(
    r: DeletionRequestDto,
    status: 'approved' | 'rejected' | 'completed',
  ) {
    const note = prompt(
      `Nota da decisão (opcional) para ${status} da conta ${r.userEmail}:`,
    );
    if (note === null) return;
    try {
      await updateMut.mutateAsync({ id: r.id, status, note: note || undefined });
      toast.success(`Marcado como ${STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Trash2 size={20} className="text-status-danger" strokeWidth={1.75} />
          Solicitações de exclusão (LGPD)
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Direito ao esquecimento. Avalie e processe a remoção dos dados do
          aluno conforme a política da escola.
        </p>
      </header>

      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar email..."
            className="pco-input text-sm flex-1"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as DeletionStatusDto | 'all')
          }
          className="pco-input text-sm"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovadas</option>
          <option value="rejected">Rejeitadas</option>
          <option value="completed">Concluídas</option>
        </select>
      </div>

      {list.isLoading ? (
        <CardListSkeleton count={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Sem solicitações"
          description={
            statusFilter !== 'all'
              ? `Nenhuma solicitação com status "${STATUS_LABELS[statusFilter as DeletionStatusDto]}".`
              : 'Nenhuma solicitação de exclusão registrada.'
          }
          icon={<Trash2 size={28} className="text-pco-blue" />}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r.id} className="pco-card p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`pco-badge text-xs ${STATUS_STYLE[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span className="text-sm font-bold text-pco-deep">
                      {r.userEmail}
                    </span>
                    <span className="text-xs text-ink-subtle">
                      <Clock size={10} className="inline" />{' '}
                      {new Date(r.requestedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {r.reason && (
                    <p className="mt-2 text-xs text-ink-muted bg-surface-mute p-2 rounded italic">
                      "{r.reason}"
                    </p>
                  )}
                  {r.resolutionNote && (
                    <div className="mt-2 text-xs text-ink-subtle">
                      <strong>Nota:</strong> {r.resolutionNote}
                      {r.resolvedBy && ` · por ${r.resolvedBy}`}
                      {r.resolvedAt &&
                        ` em ${new Date(r.resolvedAt).toLocaleString('pt-BR')}`}
                    </div>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAction(r, 'approved')}
                      disabled={updateMut.isPending}
                      className="pco-btn-secondary text-xs"
                    >
                      {updateMut.isPending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={11} strokeWidth={2} />
                      )}
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(r, 'rejected')}
                      disabled={updateMut.isPending}
                      className="pco-btn-ghost text-xs"
                    >
                      <XCircle size={11} strokeWidth={2} />
                      Rejeitar
                    </button>
                  </div>
                )}

                {r.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !confirm(
                          `Confirmar que os dados de ${r.userEmail} foram REMOVIDOS do sistema? Essa ação registra como concluída.`,
                        )
                      )
                        return;
                      void handleAction(r, 'completed');
                    }}
                    disabled={updateMut.isPending}
                    className="pco-btn-primary text-xs shrink-0"
                  >
                    <CheckCircle2 size={11} strokeWidth={2} />
                    Marcar concluída
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
