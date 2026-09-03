import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Tag, X, CheckCircle2, AlertCircle, User, FileText } from 'lucide-react';
import { useCheckCoupon, useStartCheckout } from '../data/hooks';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';
import type { CouponCheckResultDto, ProductDto } from '../data/api';
import { documentoValido, formatarDocumento } from '../../../shared/documento';

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

  // Rotulo precisa de `id` para se ligar ao campo. `useId` evita colisao se
  // dois dialogos existirem na mesma pagina.
  const uid = useId();
  const idNome = `${uid}-nome`;
  const idDoc = `${uid}-doc`;
  const idCupom = `${uid}-cupom`;
  const idTitulo = `${uid}-titulo`;
  const refNome = useRef<HTMLInputElement | null>(null);
  const refDoc = useRef<HTMLInputElement | null>(null);

  const { user } = useAuth();
  const [code, setCode] = useState('');
  // Nome e CPF do comprador.
  //
  // Não eram pedidos aqui, e o gateway recebia só o e-mail: o Pagar.me montava
  // o nome com `email.split('@')[0]` e, sem documento, recusava a cobrança —
  // nenhuma compra por dentro do app se concluía. O checkout público sempre
  // pediu os dois; esta tela ficou para trás.
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  // **Um erro por campo.** Ate 3/set/2026 o erro do NOME era gravado em
  // `erroDoc` e renderizado dentro do bloco do CPF: quem esquecia o nome lia
  // "Informe o nome de quem esta comprando." logo abaixo do campo de CPF, que
  // estava certo. E o pior tipo de erro de formulario — aponta para o lugar
  // errado — e acontecia na unica tela de compra do aluno logado.
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroDoc, setErroDoc] = useState<string | null>(null);
  const [validation, setValidation] = useState<
    | { kind: 'idle' }
    | { kind: 'ok'; data: CouponCheckResultDto }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    if (!open) {
      setCode('');
      setValidation({ kind: 'idle' });
      setErroNome(null);
      setErroDoc(null);
    }
  }, [open]);

  // O nome já cadastrado entra preenchido — quem compra o segundo curso não
  // deve redigitar o que a escola já sabe.
  useEffect(() => {
    if (open && !nome && user?.name) setNome(user.name);
  }, [open, user?.name, nome]);

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
    // Barrar aqui é o que faz um dígito trocado voltar como "confira o número"
    // em vez de "falha no pagamento". O servidor revalida com a mesma função.
    setErroNome(null);
    setErroDoc(null);
    if (!nome.trim() || nome.trim().length < 2) {
      setErroNome('Informe o nome de quem está comprando.');
      refNome.current?.focus();
      return;
    }
    if (!documentoValido(documento)) {
      setErroDoc('CPF ou CNPJ inválido — confira o número digitado.');
      refDoc.current?.focus();
      return;
    }
    try {
      const r = await startCheckout.mutateAsync({
        productId: product.id,
        couponCode:
          validation.kind === 'ok' ? validation.data.coupon.code : undefined,
        name: nome.trim(),
        document: documento,
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
      {/*
        E um `<form>`, e nao uma `<div>` com botoes soltos: sem isso, Enter no
        campo de CPF nao enviava nada — e no celular o teclado mostra "Ir",
        aperta, e nao acontece. Comportamento aprendido em qualquer outro site,
        que aqui falhava em silencio, na tela do dinheiro.
      */}
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onSubmit={(e) => {
          e.preventDefault();
          void handleConfirm();
        }}
        className="pco-card w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-lg font-bold text-pco-deep">
            Confirmar compra
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="pco-btn-ghost text-xs"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>

        <div className="pco-card border-pco-blue/20 bg-pco-blue/5 p-3">
          <div className="text-xs uppercase tracking-wide text-ink-muted">
            Produto
          </div>
          <div className="text-sm font-semibold text-pco-deep mt-0.5">
            {product.name}
          </div>
        </div>

        <div>
          <label
            htmlFor={idNome}
            className="text-xs uppercase tracking-wide text-ink-muted flex items-center gap-1"
          >
            <User size={11} strokeWidth={2} />
            Nome completo
          </label>
          <input
            id={idNome}
            ref={refNome}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErroNome(null);
            }}
            placeholder="Como está no documento"
            maxLength={120}
            autoComplete="name"
            required
            aria-invalid={erroNome ? true : undefined}
            aria-describedby={erroNome ? `${idNome}-erro` : undefined}
            className="pco-input text-sm mt-1"
          />
          {erroNome && (
            <p
              id={`${idNome}-erro`}
              className="mt-1 text-xs text-status-danger flex items-center gap-1"
            >
              <AlertCircle size={10} />
              {erroNome}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={idDoc}
            className="text-xs uppercase tracking-wide text-ink-muted flex items-center gap-1"
          >
            <FileText size={11} strokeWidth={2} />
            CPF ou CNPJ
          </label>
          <input
            id={idDoc}
            ref={refDoc}
            value={documento}
            onChange={(e) => {
              setDocumento(formatarDocumento(e.target.value));
              setErroDoc(null);
            }}
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={18}
            autoComplete="off"
            required
            aria-invalid={erroDoc ? true : undefined}
            aria-describedby={`${idDoc}-dica${erroDoc ? ` ${idDoc}-erro` : ''}`}
            className="pco-input text-sm font-mono mt-1"
          />
          <p id={`${idDoc}-dica`} className="mt-1 text-xs text-ink-subtle">
            Exigido pelo meio de pagamento para emitir a cobrança.
          </p>
          {erroDoc && (
            <p
              id={`${idDoc}-erro`}
              className="mt-1 text-xs text-status-danger flex items-center gap-1"
            >
              <AlertCircle size={10} />
              {erroDoc}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={idCupom}
            className="text-xs uppercase tracking-wide text-ink-muted flex items-center gap-1"
          >
            <Tag size={11} strokeWidth={2} />
            Cupom de desconto (opcional)
          </label>
          <div className="mt-1 flex items-stretch gap-2">
            <input
              id={idCupom}
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
            <p className="mt-1 text-xs text-status-danger flex items-center gap-1">
              <AlertCircle size={10} />
              {validation.message}
            </p>
          )}
          {validation.kind === 'ok' && (
            <p className="mt-1 text-xs text-status-success flex items-center gap-1">
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
            type="submit"
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
      </form>
    </div>
  );
}
