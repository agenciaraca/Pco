import { useEffect, useState } from 'react';
import { Loader2, Tag, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCheckCoupon, useStartCheckout } from '../data/hooks';
import { useToast } from './Toast';
import type { CouponCheckResultDto, ProductDto } from '../data/api';

export interface CheckoutDialogProps {
  product: ProductDto;
  open: boolean;
  onClose: () => void;
  /** Callback após o pedido ser criado com sucesso. */
  onSuccess?: (order: { id: string; checkoutUrl?: string | null }) => void;
}

export default function CheckoutDialog({
  product,
  open,
  onClose,
  onSuccess,
}: CheckoutDialogProps) {
  const checkCoupon = useCheckCoupon();
  const startCheckout = useStartCheckout();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [validation, setValidation] = useState<
    | { kind: 'idle' }
    | { kind: 'ok'; data: CouponCheckResultDto }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    if (!open) {
      setCode('');
      setValidation({ kind: 'idle' });
    }
  }, [open]);

  if (!open) return null;

  async function handleValidate() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setValidation({ kind: 'idle' });
      return;
    }
    try {
      const r = await checkCoupon.mutateAsync({
        code: trimmed,
        productId: product.id,
      });
      setValidation({ kind: 'ok', data: r });
    } catch (err) {
      setValidation({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Cupom inválido',
      });
    }
  }

  async function handleConfirm() {
    try {
      const r = await startCheckout.mutateAsync({
        productId: product.id,
        couponCode:
          validation.kind === 'ok' ? validation.data.coupon.code : undefined,
      });
      onSuccess?.(r);
      onClose();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const finalAmountCents =
    validation.kind === 'ok'
      ? validation.data.finalAmountCents
      : product.priceCents;
  const discount =
    validation.kind === 'ok' ? validation.data.discountCents : 0;

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: product.currency,
    });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="pco-card w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-pco-deep">Confirmar compra</h2>
          <button
            type="button"
            onClick={onClose}
            className="pco-btn-ghost text-xs"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>

        <div className="pco-card border-pco-blue/20 bg-pco-blue/5 p-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">
            Produto
          </div>
          <div className="text-sm font-semibold text-pco-deep mt-0.5">
            {product.name}
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink-muted flex items-center gap-1">
            <Tag size={11} strokeWidth={2} />
            Cupom de desconto (opcional)
          </label>
          <div className="mt-1 flex items-stretch gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setValidation({ kind: 'idle' });
              }}
              placeholder="DIGITECUPOM"
              maxLength={40}
              className="pco-input text-sm font-mono flex-1"
            />
            <button
              type="button"
              onClick={handleValidate}
              disabled={!code.trim() || checkCoupon.isPending}
              className="pco-btn-secondary text-xs"
            >
              {checkCoupon.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                'Validar'
              )}
            </button>
          </div>
          {validation.kind === 'error' && (
            <p className="mt-1 text-[11px] text-status-danger flex items-center gap-1">
              <AlertCircle size={10} />
              {validation.message}
            </p>
          )}
          {validation.kind === 'ok' && (
            <p className="mt-1 text-[11px] text-status-success flex items-center gap-1">
              <CheckCircle2 size={10} />
              Cupom aplicado: {fmt(discount)} de desconto
            </p>
          )}
        </div>

        <div className="space-y-1 border-t border-pco-border pt-3 text-sm">
          <div className="flex justify-between text-ink-muted">
            <span>Subtotal</span>
            <span>{fmt(product.priceCents)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-status-success">
              <span>Desconto</span>
              <span>-{fmt(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-pco-deep border-t border-pco-border pt-1 mt-1">
            <span>Total</span>
            <span>{fmt(finalAmountCents)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} className="pco-btn-ghost text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={startCheckout.isPending}
            className="pco-btn-primary"
          >
            {startCheckout.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} strokeWidth={2} />
            )}
            Continuar para pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
