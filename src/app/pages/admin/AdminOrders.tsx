import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  RefreshCw,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Plus,
  Pencil,
  Eye,
  Trash2,
} from 'lucide-react';
import * as api from '../../data/api';
import {
  useAllOrders,
  useAdminUpdateOrderStatus,
  useAdminRefundOrder,
  useDeleteOrder,
} from '../../data/hooks';
import { resumoDaOrigem } from '../../../../shared/atribuicao';
import { ROTULO_METODO } from '../../../../shared/metodos-pagamento';
import SavedSearchesBar from '../../components/SavedSearchesBar';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import type { OrderDto, OrderStatus } from '../../data/api';
import SortableTh from '../../components/SortableTh';
import { useTableSort } from '../../hooks/useTableSort';

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
  const navigate = useNavigate();
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.orders')} — Admin AVA PCO` });
  const { data, isLoading, isError, refetch, isFetching } = useAllOrders();
  const updateStatusMut = useAdminUpdateOrderStatus();
  const refundMut = useAdminRefundOrder();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [refundOrder, setRefundOrder] = useState<OrderDto | null>(null);
  const [vendo, setVendo] = useState<OrderDto | null>(null);
  const [apagando, setApagando] = useState<OrderDto | null>(null);
  const apagarMut = useDeleteOrder();

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

  const {
    rows: sortedFiltered,
    field: sortField,
    direction: sortDirection,
    toggleSort,
  } = useTableSort(
    filtered,
    (row, field) => {
      switch (field) {
        case 'id':
          return row.id;
        case 'user':
          return row.userEmail;
        case 'product':
          return row.productSnapshot.name;
        case 'gateway':
          return row.gatewayId;
        case 'metodo':
          // Sem método gravado ordena por último, e não junto com o pix: o
          // pedido é anterior ao campo, e "não se sabe" não é um valor.
          return row.metodo ?? 'zzz';
        case 'amount':
          return row.amountCents;
        case 'status':
          return row.status;
        case 'createdAt':
          return row.createdAt;
        default:
          return null;
      }
    },
    'createdAt',
    'desc',
  );

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
          <h1 className="text-2xl font-bold text-pco-deep">{t('admin.nav.orders')}</h1>
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
          <Link to="/admin/pedidos/novo" className="pco-btn-primary text-xs">
            <Plus size={12} strokeWidth={2} />
            Novo pedido
          </Link>
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
          <div className="text-xs uppercase tracking-wide text-ink-muted">
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
          <div className="text-xs uppercase tracking-wide text-ink-muted">Reembolsos</div>
          <div className="mt-1 text-2xl font-bold text-pco-cyan">
            {(totalRefunded / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </div>
        </div>
        <div className="pco-card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-muted">Pendentes</div>
          <div className="mt-1 text-2xl font-bold text-pco-orange">{counts.pending}</div>
        </div>
        <div className="pco-card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-muted">Total</div>
          <div className="mt-1 text-2xl font-bold text-pco-deep">{counts.all}</div>
        </div>
      </div>

      <div className="pco-card p-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, origem, campanha ou id..."
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
        <span className="text-xs text-ink-muted">
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
                <SortableTh field="id" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Pedido
                </SortableTh>
                <SortableTh field="user" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Aluno
                </SortableTh>
                <SortableTh field="product" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Origem
                </SortableTh>
                <SortableTh field="gateway" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Gateway
                </SortableTh>
                <SortableTh field="metodo" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Método
                </SortableTh>
                <SortableTh field="amount" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Valor
                </SortableTh>
                <SortableTh field="status" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Status
                </SortableTh>
                <SortableTh field="createdAt" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">
                  Quando
                </SortableTh>
                <th className="text-right px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {sortedFiltered.map((o) => {
                const style = statusStyle[o.status];
                const Icon = style.Icon;
                return (
                  <tr key={o.id} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 font-mono text-xs text-pco-deep">{o.id}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag
                          size={11}
                          strokeWidth={2}
                          className="text-pco-blue shrink-0"
                        />
                        {/* Nome na frente, e-mail embaixo. Quem compra como
                            visitante não tem conta e por isso não tem nome — aí
                            o e-mail sobe, em vez de a linha ficar vazia. */}
                        <div className="min-w-0">
                          <div className="font-medium text-pco-deep truncate max-w-[180px]">
                            {o.userName ?? o.userEmail}
                          </div>
                          {o.userName && (
                            <div className="text-xs text-ink-muted truncate max-w-[180px]">
                              {o.userEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[200px]">
                      <CelulaOrigem pedido={o} />
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">{o.gatewayProvider}</td>
                    <td className="px-3 py-2 text-xs">
                      <CelulaMetodo pedido={o} />
                    </td>
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
                    <td className="px-3 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('pt-BR')}
                    </td>
                    {/* Só CRUD aqui. Reembolsar e cancelar são ações de
                        negócio — chamam gateway, mexem em acesso — e passaram
                        para dentro do detalhe, onde quem clica está olhando o
                        pedido inteiro em vez de uma linha de tabela. */}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          onClick={() => setVendo(o)}
                          className="pco-btn-ghost text-xs p-1.5"
                          title="Ver pedido"
                          aria-label={`Ver pedido ${o.id}`}
                        >
                          <Eye size={13} strokeWidth={2} />
                        </button>
                        <Link
                          to={`/admin/pedidos/${encodeURIComponent(o.id)}/editar`}
                          className="pco-btn-ghost text-xs p-1.5"
                          title="Editar pedido"
                          aria-label={`Editar pedido ${o.id}`}
                        >
                          <Pencil size={13} strokeWidth={2} />
                        </Link>
                        <button
                          onClick={() => setApagando(o)}
                          className="pco-btn-ghost text-xs p-1.5 text-status-danger"
                          title="Apagar pedido"
                          aria-label={`Apagar pedido ${o.id}`}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {apagando && (
        <ConfirmaExclusao
          pedido={apagando}
          isPending={apagarMut.isPending}
          onClose={() => setApagando(null)}
          onConfirmar={async () => {
            try {
              await apagarMut.mutateAsync(apagando.id);
              toast.success('Pedido apagado', 'A matrícula não foi tocada.');
              setApagando(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      {vendo && (
        <DetalhePedido
          pedido={vendo}
          onClose={() => setVendo(null)}
          onEditar={() => {
            navigate(`/admin/pedidos/${encodeURIComponent(vendo.id)}/editar`);
            setVendo(null);
          }}
          onReembolsar={() => {
            setRefundOrder(vendo);
            setVendo(null);
          }}
          onCancelar={async () => {
            await setStatus(vendo, 'canceled');
            setVendo(null);
          }}
        />
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

/**
 * A coluna que substituiu "Produto": de onde veio a venda.
 *
 * Produto já aparece no valor e no detalhe; o que a lista não sabia dizer era
 * qual campanha converteu. Sem origem conhecida a célula mostra travessão —
 * 1.125 dos 1.845 pedidos importados estão nessa situação, e chamá-los de
 * "direto" seria inventar medição.
 */
/**
 * Pix, boleto ou cartão — e o travessão quando não se sabe.
 *
 * O campo existe desde 5/set/2026. Pedido anterior a isso **não tem** método
 * gravado, e a tela precisa dizer isso em vez de escolher um: mostrar "pix"
 * onde ninguém mediu é a mesma classe de erro de um painel de métricas que
 * transforma ausência em zero.
 *
 * O carnê aparece aqui porque é a informação que muda o que a coordenação faz:
 * pedido parcelado segue recebendo aviso de parcela por meses depois de pago,
 * e é ele que aparece "em atraso" sem o pedido estar falho.
 */
function CelulaMetodo({ pedido }: { pedido: OrderDto }) {
  if (!pedido.metodo) return <span className="text-ink-subtle">—</span>;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-pco-deep">{ROTULO_METODO[pedido.metodo]}</span>
      {pedido.gatewayInstallmentId && (
        <span
          className="pco-badge bg-pco-blue/10 text-pco-blue"
          title="Carnê: as parcelas seguintes têm cobrança própria e chegam por webhook."
        >
          carnê
        </span>
      )}
    </div>
  );
}

function CelulaOrigem({ pedido }: { pedido: OrderDto }) {
  const r = resumoDaOrigem(pedido.attribution);
  if (!r) {
    return (
      <span className="text-ink-muted" title="Origem não registrada neste pedido">
        —
      </span>
    );
  }
  return (
    <div className="min-w-0" title={pedido.productSnapshot.name}>
      <div className="font-medium text-pco-deep truncate">{r.canal}</div>
      {r.detalhe && <div className="text-xs text-ink-muted truncate">{r.detalhe}</div>}
    </div>
  );
}

function Campo({
  label,
  children,
  dica,
}: {
  label: string;
  children: React.ReactNode;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
      {dica && <span className="block text-xs text-ink-muted mt-0.5">{dica}</span>}
    </label>
  );
}

/** Ver o pedido inteiro — e é daqui que saem as ações de negócio. */
function DetalhePedido({
  pedido,
  onClose,
  onEditar,
  onReembolsar,
  onCancelar,
}: {
  pedido: OrderDto;
  onClose: () => void;
  onEditar: () => void;
  onReembolsar: () => void;
  onCancelar: () => void;
}) {
  const r = resumoDaOrigem(pedido.attribution);
  const linha = (k: string, v: React.ReactNode) => (
    <div className="flex gap-2 text-xs">
      <span className="text-ink-muted w-28 shrink-0">{k}</span>
      <span className="text-pco-deep min-w-0 break-words">{v}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="pco-card w-full max-w-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Pedido ${pedido.id}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-pco-deep">Pedido {pedido.id}</h2>
          <button onClick={onClose} className="pco-btn-ghost p-1" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5">
          {linha('Aluno', pedido.userName ?? '—')}
          {linha('E-mail', pedido.userEmail)}
          {linha('Produto', pedido.productSnapshot.name)}
          {linha(
            'Valor',
            (pedido.amountCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: pedido.currency,
            }),
          )}
          {linha('Gateway', pedido.gatewayProvider)}
          {linha('Método', pedido.metodo ? ROTULO_METODO[pedido.metodo] : '—')}
          {pedido.gatewayInstallmentId &&
            linha('Parcelamento', `carnê · ${pedido.gatewayInstallmentId}`)}
          {linha('Origem', r ? `${r.canal}${r.detalhe ? ` · ${r.detalhe}` : ''}` : '—')}
          {pedido.attribution?.referrer && linha('Veio de', pedido.attribution.referrer)}
          {linha('Criado', new Date(pedido.createdAt).toLocaleString('pt-BR'))}
          {pedido.paidAt && linha('Pago em', new Date(pedido.paidAt).toLocaleString('pt-BR'))}
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-ink-muted mb-1">Histórico</h3>
          <ol className="space-y-1">
            {pedido.events.map((e, i) => (
              <li key={i} className="text-xs text-ink-muted">
                <span className="font-mono">{new Date(e.ts).toLocaleString('pt-BR')}</span>{' '}
                <strong className="text-pco-deep">{e.status}</strong>
                {e.note ? ` — ${e.note}` : ''}
              </li>
            ))}
          </ol>
        </div>

        {/* Ações de negócio moram aqui, não na linha da tabela: chamam gateway
            e mexem em acesso, e quem clica precisa estar vendo o pedido todo. */}
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-surface-mute">
          {pedido.status === 'paid' && (
            <button onClick={onReembolsar} className="pco-btn-ghost text-xs text-pco-cyan">
              Reembolsar via gateway
            </button>
          )}
          {(pedido.status === 'pending' || pedido.status === 'processing') && (
            <button onClick={onCancelar} className="pco-btn-ghost text-xs text-status-danger">
              Cancelar pedido
            </button>
          )}
          <button onClick={onEditar} className="pco-btn-primary text-xs">
            <Pencil size={12} strokeWidth={2} />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmaExclusao({
  pedido,
  isPending,
  onClose,
  onConfirmar,
}: {
  pedido: OrderDto;
  isPending: boolean;
  onClose: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="pco-card w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Apagar pedido"
      >
        <h2 className="text-lg font-semibold text-pco-deep">Apagar este pedido?</h2>
        <p className="text-sm text-ink-muted">
          <strong>{pedido.productSnapshot.name}</strong> ·{' '}
          {(pedido.amountCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: pedido.currency,
          })}{' '}
          · {pedido.userName ?? pedido.userEmail}
        </p>
        <p className="text-xs text-status-danger">
          O pedido some do histórico e não volta. <strong>A matrícula não é tocada</strong> — se
          esta pessoa tem acesso por causa desta compra, o acesso continua, agora sem lastro.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="pco-btn-ghost text-sm">
            Manter
          </button>
          <button
            disabled={isPending}
            onClick={onConfirmar}
            className="pco-btn-primary text-sm bg-status-danger"
          >
            {isPending ? 'Apagando…' : 'Apagar'}
          </button>
        </div>
      </div>
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
            <span className="text-xs uppercase tracking-wide text-ink-muted">
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
          <span className="text-xs uppercase tracking-wide text-ink-muted">
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

        <div className="text-xs rounded bg-pco-orange/10 border border-pco-orange/30 p-2 text-pco-orange">
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
