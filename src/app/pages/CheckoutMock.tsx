import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export default function CheckoutMock() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const externalId = params.get('externalId') ?? '';
  const orderId = params.get('orderId') ?? '';
  const amount = Number(params.get('amount') ?? '0');
  const currency = params.get('currency') ?? 'BRL';
  const description = params.get('description') ?? '';

  const [status, setStatus] = useState<'idle' | 'submitting' | 'paid' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function confirm(action: 'paid' | 'failed') {
    setStatus('submitting');
    setError(null);
    try {
      // Descobre gatewayId via /admin/orders? Não — não tem auth admin no aluno.
      // Usamos o endpoint /me/orders pra encontrar gatewayId.
      const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
      const token = session?.token;
      if (!token) throw new Error('Não autenticado');

      const ordersRes = await fetch('/api/me/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!ordersRes.ok) throw new Error(`HTTP ${ordersRes.status}`);
      const orders = (await ordersRes.json()) as Array<{
        id: string;
        gatewayId: string;
      }>;
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Pedido não encontrado.');

      // Dispara webhook
      const webhookRes = await fetch(`/api/payments/webhook/${order.gatewayId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ externalId, status: action }),
      });
      if (!webhookRes.ok) {
        const j = await webhookRes.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${webhookRes.status}`);
      }

      if (action === 'paid') {
        setStatus('paid');
        setTimeout(() => navigate('/perfil', { replace: true }), 2500);
      } else {
        setStatus('error');
        setError('Pagamento marcado como falho.');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const formattedAmount = (amount / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
  });

  return (
    <div className="min-h-screen bg-surface-off px-6 py-10">
      <div className="max-w-md mx-auto">
        <SiteHeader />

        <div className="pco-card p-6 space-y-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-pco-orange">
              Sandbox · checkout simulado
            </div>
            <h1 className="text-2xl font-bold text-pco-deep mt-1">Confirmar pagamento</h1>
            <p className="text-xs text-ink-muted mt-1">
              Esta é uma página de simulação. Em produção, esse fluxo redireciona para o gateway
              real (Stripe, Asaas, etc.).
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="Produto" value={description || '—'} />
            <Row label="Valor" value={formattedAmount} highlight />
            <Row label="ID externo" value={externalId} mono />
            <Row label="ID do pedido" value={orderId} mono />
          </dl>

          {status === 'paid' ? (
            <div className="rounded-lg bg-status-success/10 p-3 flex items-start gap-2 text-sm text-status-success">
              <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <div>
                <strong>Pagamento confirmado!</strong>
                <p className="text-xs mt-0.5">Acesso liberado. Redirecionando...</p>
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="rounded-lg bg-status-danger/10 p-3 flex items-start gap-2 text-sm text-status-danger">
              <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {status !== 'paid' && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => confirm('failed')}
                disabled={status === 'submitting'}
                className="pco-btn-secondary text-sm justify-center"
              >
                Simular falha
              </button>
              <button
                onClick={() => confirm('paid')}
                disabled={status === 'submitting'}
                className="pco-btn-primary text-sm justify-center"
              >
                {status === 'submitting' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} strokeWidth={2} />
                )}
                Confirmar pagamento
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className={`text-right ${highlight ? 'text-base font-bold text-pco-deep' : 'text-sm font-semibold text-pco-deep'} ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
