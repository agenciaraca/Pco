import { useState, useMemo } from 'react';
import {
  ShoppingBag,
  RefreshCw,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
} from 'lucide-react';
import * as api from '../../data/api';
import {
  useAllOrders,
  useAdminUpdateOrderStatus,
  useAdminRefundOrder,
} from '../../data/hooks';
import SavedSearchesBar from '../../components/SavedSearchesBar';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { OrderDto, OrderStatus } from '../../data/api';

const statusStyle: Record<OrderStatus, { className: string; label: string; Icon: typeof Clock }> =
  {
    pending: {
      className: 'bg-pco-orange/10 text-pco-orange',
      label: 'Pendente',
      Icon: Clock,
    },
    processing: {
      className: 'bg-pco-blue/10 text-pco-blue',
      label: 'Processando',
      Icon: Clock,
    },
    paid: {
      className: 'bg-status-success/10 text-status-success',
      label: 'Pago',
      Icon: CheckCircle2,
    },
    failed: {
      className: 'bg-status-danger/15 text-status-danger',
      label: 'Falhou',
      Icon: AlertCircle,
    },
    canceled: {
      className: 'bg-surface-gray text-ink-muted',
      label: 'Cancelado',
      Icon: X,
    },
    refunded: {
      className: 'bg-pco-cyan/15 text-pco-cyan',
      label: 'Reembolsado',
      Icon: AlertCircle,
    },
  };

export default function AdminOrders() {
  useDocumentMeta({ title: 'Pedidos — Admin AVA PCO' });
  const { data, isLoading, isError, refetch, isFetching } = useAllOrders();
  const updateStatusMut = useAdminUpdateOrderStatus();
  const refundMut = useAdminRefundOrder();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [refundOrder, setRefundOrder] = useState<OrderDto | null>(null);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.userEmail.toLowerCase().includes(q) ||
          o.productSnapshot.name.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: data?.length ?? 0,
      pending: 0,
      processing: 0,
      paid: 0,
      failed: 0,
      canceled: 0,
      refunded: 0,
    };
    for (const o of data ?? []) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [data]);

  const totalRevenue = (data ?? [])
    .filter((o) => o.status === 'paid')
    .reduce((s, o) => s + o.amountCents, 0);
  const totalRefunded = (data ?? [])
    .filter((o) => o.status === 'refunded')
    .reduce((s, o) => s + o.amountCents, 0);

  async function setStatus(o: OrderDto, status: 'canceled' | 'refunded' | 'failed') {
    const note = prompt(`Nota interna para mudança para "${status}":`, '');
    if (note === null) return;
    try {
      await updateStatusMut.mutateAsync({ id: o.id, status, note: note || undefined });
      toast.success(`Status atualizado: ${status}`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep">Pedidos</h1>
          <p className="text-sm text-ink-muted">
            Compras feitas pelos alunos. Webhook do gateway atualiza status automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await api.downloadOrdersCsv();
                toast.success('CSV baixado');
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            className="pco-btn-ghost text-xs"
          >
            <Download size={12} strokeWidth={2} />
            Exportar CSV
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="pco-btn-secondary text-xs"
          >
            <RefreshCw size={12} strokeWidth={2} className={isFetching ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">
            Receita confirmada
          </div>
          <div className="mt-1 text-2xl font-bold text-status-success">
            {(totalRevenue / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </div>
        </div>
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Reembolsos</div>
          <div className="mt-1 text-2xl font-bold text-pco-cyan">
            {(totalRefunded / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </div>
        </div>
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Pendentes</div>
          <div className="mt-1 text-2xl font-bold text-pco-orange">{counts.pending}</div>
        </div>
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Total</div>
          <div className="mt-1 text-2xl font-bold text-pco-deep">{counts.all}</div>
        </div>
      </div>

      <div className="pco-card p-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por email, produto ou id..."
          className="pco-input flex-1 min-w-[200px] text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
          className="pco-input w-auto text-sm"
        >
          <option value="all">Todos status ({counts.all})</option>
          <option value="pending">Pendente ({counts.pending})</option>
          <option value="processing">Processando ({counts.processing ?? 0})</option>
          <option value="paid">Pago ({counts.paid})</option>
          <option value="failed">Falhou ({counts.failed})</option>
          <option value="canceled">Cancelado ({counts.canceled})</option>
          <option value="refunded">Reembolsado ({counts.refunded})</option>
        </select>
        <span className="text-[11px] text-ink-muted">
          <Filter size={11} strokeWidth={2} className="inline mr-1" />
          {filtered.length} de {counts.all}
        </span>
      </div>

      <SavedSearchesBar
        scope="orders"
        currentFilters={
          statusFilter === 'all' && !search.trim()
            ? {}
            : { statusFilter, search: search.trim() }
        }
        onApply={(f) => {
          if (typeof f.statusFilter === 'string') {
            setStatusFilter(f.statusFilter as 'all' | OrderStatus);
          }
          if (typeof f.search === 'string') {
            setSearch(f.search);
          }
        }}
      />

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          action={
            <button onClick={() => refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum pedido com esse filtro" />
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-mute text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Pedido</th>
                <th className="text-left px-3 py-2 font-medium">Aluno</th>
                <th className="text-left px-3 py-2 font-medium">Produto</th>
                <th className="text-left px-3 py-2 font-medium">Gateway</th>
                <th className="text-left px-3 py-2 font-medium">Valor</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Quando</th>
                <th className="text-right px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {filtered.map((o) => {
                const style = statusStyle[o.status];
                const Icon = style.Icon;
                return (
                  <tr key={o.id} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 font-mono text-[11px] text-pco-deep">{o.id}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag
                          size={11}
                          strokeWidth={2}
                          className="text-pco-blue shrink-0"
                        />
                        <span className="font-medium text-pco-deep">{o.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted truncate max-w-[200px]">
                      {o.productSnapshot.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">{o.gatewayProvider}</td>
                    <td className="px-3 py-2 font-semibold text-pco-deep whitespace-nowrap">
                      {(o.amountCents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: o.currency,
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`pco-badge ${style.className}`}>
                        <Icon size={10} strokeWidth={2} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink-muted whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {o.status === 'paid' && (
                          <button
                            onClick={() => setRefundOrder(o)}
                            className="pco-btn-ghost text-[11px] text-pco-cyan"
                            title="Reembolsar via gateway"
                          >
                            Reembolsar
                          </button>
                        )}
                        {(o.status === 'pending' || o.status === 'processing') && (
                          <button
                            onClick={() => setStatus(o, 'canceled')}
                            className="pco-btn-ghost text-[11px] text-status-danger"
                            title="Cancelar"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          isPending={refundMut.isPending}
          onConfirm={async (amountCents, reason) => {
            try {
              const r = await refundMut.mutateAsync({
                id: refundOrder.id,
                amountCents,
                reason,
              });
              toast.success(
                'Reembolso processado',
                `${(r.refundedCents / 100).toLocaleString('pt-BR')} ${refundOrder.currency} ${r.partial ? '(parcial)' : '(total)'}${r.externalRefundId ? ` · ${r.externalRefundId}` : ''}`,
              );
              setRefundOrder(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}
    </div>
  );
}

function RefundModal({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: OrderDto;
  onClose: () => void;
  onConfirm: (amountCents: number | undefined, reason: string | undefined) => void;
  isPending: boolean;
}) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState<string>(
    (order.amountCents / 100).toFixed(2),
  );
  const [reason, setReason] = useState('');

  const amountCents = partial
    ? Math.round(Number(amount.replace(',', '.')) * 100) || undefined
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-pco-deep">Reembolsar pedido</h3>
        <div className="text-xs text-ink-muted space-y-1">
          <div>
            <strong>Aluno:</strong> {order.userEmail}
          </div>
          <div>
            <strong>Produto:</strong> {order.productSnapshot.name}
          </div>
          <div>
            <strong>Total pago:</strong>{' '}
            {(order.amountCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: order.currency || 'BRL',
            })}
          </div>
          <div>
            <strong>Gateway:</strong> {order.gatewayProvider}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={partial}
            onChange={(e) => setPartial(e.target.checked)}
            className="accent-pco-blue"
          />
          Reembolso parcial
        </label>

        {partial && (
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Valor a reembolsar ({order.currency || 'BRL'})
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pco-input mt-1 text-sm"
              placeholder="0,00"
            />
          </label>
        )}

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Motivo (opcional)
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="pco-input mt-1 text-sm"
            placeholder="Ex: Cliente solicitou reembolso por DM"
          />
        </label>

        <div className="text-[11px] rounded bg-pco-orange/10 border border-pco-orange/30 p-2 text-pco-orange">
          ⚠ Esta ação chama o gateway real e remove o acesso do aluno (refund total).
          Não é reversível.
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="pco-btn-ghost text-xs">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(amountCents, reason || undefined)}
            disabled={isPending || (partial && (!amountCents || amountCents <= 0))}
            className="pco-btn-primary text-xs"
          >
            {isPending ? 'Processando...' : 'Confirmar refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
