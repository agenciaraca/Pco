import { Link } from 'react-router-dom';
import { ShoppingBag, ExternalLink, X, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react';
import { useMyOrders, useCancelMyOrder } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { OrderDto, OrderStatus } from '../data/api';

const statusStyle: Record<OrderStatus, { className: string; label: string; Icon: typeof Clock }> =
  {
    pending: {
      className: 'bg-pco-orange/10 text-pco-orange',
      label: 'Aguardando pagamento',
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

export default function Pedidos() {
  useDocumentMeta({ title: 'Meus Pedidos — AVA PCO' });
  const { data, isLoading, isError, refetch } = useMyOrders();
  const cancelMut = useCancelMyOrder();
  const toast = useToast();

  async function handleCancel(o: OrderDto) {
    if (!confirm(`Cancelar pedido "${o.productSnapshot.name}"?`)) return;
    try {
      await cancelMut.mutateAsync(o.id);
      toast.success('Pedido cancelado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  function openInvoice(orderId: string) {
    const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
    const token = session?.token;
    // Para passar Authorization header pra um GET aberto em nova aba, usamos
    // uma URL com token no query? Não — backend não aceita. Fazemos fetch
    // e abrimos blob URL.
    void (async () => {
      try {
        const res = await fetch(`/api/me/orders/${encodeURIComponent(orderId)}/invoice`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          toast.error('Falha', `HTTP ${res.status}`);
          return;
        }
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err) {
        toast.error('Falha', err instanceof Error ? err.message : 'Erro');
      }
    })();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Meus Pedidos</h1>
        <p className="pco-section-subtitle mt-1">
          Histórico de compras de cursos, pacotes de sessão e Tutor.
        </p>
      </header>

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : isError ? (
        <ErrorState
          action={
            <button onClick={() => refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nenhum pedido ainda"
          description="Quando você comprar um curso ou pacote, ele aparece aqui."
          action={
            <Link to="/cursos" className="pco-btn-primary text-xs">
              Ver cursos disponíveis
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {data.map((o) => {
            const style = statusStyle[o.status];
            const Icon = style.Icon;
            const price = (o.amountCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: o.currency,
            });
            return (
              <li key={o.id} className="pco-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-pco-blue/10 grid place-items-center shrink-0">
                      <ShoppingBag size={16} className="text-pco-blue" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-pco-deep">
                          {o.productSnapshot.name}
                        </span>
                        <span className={`pco-badge ${style.className}`}>
                          <Icon size={10} strokeWidth={2} />
                          {style.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-subtle">
                        Pedido <code>{o.id}</code> · {o.gatewayProvider} · criado em{' '}
                        {new Date(o.createdAt).toLocaleString('pt-BR')}
                        {o.paidAt && (
                          <>
                            {' · '}
                            pago em {new Date(o.paidAt).toLocaleString('pt-BR')}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-pco-deep">{price}</div>
                  </div>
                </div>

                {o.status === 'pending' && o.qrCode && (
                  <PixBlock qrCode={o.qrCode} amountCents={o.amountCents} currency={o.currency} />
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {o.status === 'pending' && o.checkoutUrl && (
                    <a
                      href={o.checkoutUrl}
                      target={o.checkoutUrl.startsWith('/') ? '_self' : '_blank'}
                      rel="noreferrer"
                      className="pco-btn-primary text-xs"
                    >
                      <ExternalLink size={11} strokeWidth={2} />
                      Concluir pagamento
                    </a>
                  )}
                  {o.status === 'paid' && o.productSnapshot.kind === 'course' && o.productSnapshot.refId && (
                    <Link
                      to={`/curso/${o.productSnapshot.refId}`}
                      className="pco-btn-secondary text-xs"
                    >
                      Ir ao curso
                    </Link>
                  )}
                  {(o.status === 'paid' || o.status === 'refunded') && (
                    <button
                      type="button"
                      onClick={() => openInvoice(o.id)}
                      className="pco-btn-ghost text-xs"
                      title="Abrir recibo (use Cmd+P para salvar como PDF)"
                    >
                      <FileText size={11} strokeWidth={2} />
                      Recibo
                    </button>
                  )}
                  {(o.status === 'pending' || o.status === 'processing') && (
                    <button
                      onClick={() => handleCancel(o)}
                      disabled={cancelMut.isPending}
                      className="pco-btn-ghost text-xs text-status-danger"
                    >
                      <X size={11} strokeWidth={2} />
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Mostra QR Code PIX (base64 ou string copia-cola) com botão de copiar.
 * Aceita: data:image/png;base64,xxx (renderiza img) ou plain string EMV.
 */
function PixBlock({
  qrCode,
  amountCents,
  currency,
}: {
  qrCode: string;
  amountCents: number;
  currency: string;
}) {
  const isImage = qrCode.startsWith('data:image') || qrCode.startsWith('iVBOR');
  const imgSrc = qrCode.startsWith('data:image')
    ? qrCode
    : isImage
      ? `data:image/png;base64,${qrCode}`
      : '';
  const copyText = isImage ? '' : qrCode;
  const price = (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
  });
  return (
    <div className="mt-3 pco-card border-pco-cyan/40 bg-pco-cyan/5 p-3">
      <div className="text-[11px] uppercase tracking-wide text-pco-cyan font-semibold mb-2">
        Pagamento via PIX — {price}
      </div>
      <div className="flex items-start gap-3 flex-wrap">
        {isImage && imgSrc && (
          <img
            src={imgSrc}
            alt="QR Code PIX"
            className="h-32 w-32 rounded border border-pco-border bg-white"
          />
        )}
        {copyText && (
          <div className="flex-1 min-w-[200px] space-y-2">
            <p className="text-[11px] text-ink-muted">
              Use seu app bancário para escanear o QR ou copie o código abaixo.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] font-mono break-all bg-white p-2 rounded border border-pco-border max-h-16 overflow-y-auto">
                {copyText}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copyText);
                  } catch {
                    /* ignore */
                  }
                }}
                className="pco-btn-secondary text-xs"
              >
                Copiar
              </button>
            </div>
          </div>
        )}
        {isImage && !copyText && (
          <p className="text-[11px] text-ink-muted flex-1">
            Escaneie com o app do seu banco para concluir o pagamento.
          </p>
        )}
      </div>
    </div>
  );
}
