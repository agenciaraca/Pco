import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Tag, X, CheckCircle2, AlertCircle, User, FileText } from 'lucide-react';
import { useCheckCoupon, useStartCheckout } from '../data/hooks';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';
import type { CouponCheckResultDto, ProductDto } from '../data/api';
import { documentoValido, formatarDocumento } from '../../../shared/documento';
import {
  UFS,
  cepValido,
  dataDeNascimentoValida,
  formatarCep,
  ufValida,
  type UF,
} from '../../../shared/endereco';
import {
  METODOS_PAGAMENTO,
  ROTULO_METODO,
  exigeDocumento,
} from '../../../shared/metodos-pagamento';
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';

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
  /**
   * O meio de pagamento decide **qual gateway cobra** — ver
   * `server/payments/roteamento.ts`. Enquanto ele não era mandado, cada gateway
   * decidia sozinho: o Asaas cobrava Pix por omissão, e ninguém tinha escolhido.
   *
   * Cartão é o padrão porque é a condição que a vitrine anuncia (12x sem juros).
   */
  const [metodo, setMetodo] = useState<MetodoPagamento>('credit_card');
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
  /*
    Nascimento e endereço.

    Opcionais aqui e obrigatórios no checkout público, e a assimetria é
    deliberada: esta tela é do aluno já logado, que pode estar comprando o
    segundo curso, e ainda não há onde guardar o endereço para preencher
    sozinho. Exigir sem prefill obrigaria a redigitar tudo a cada compra.

    A exceção é o BOLETO: o gateway o recusa sem CEP e sem número, então ali
    vira obrigatório — a mesma regra que o CPF já segue nesta tela.
  */
  const [nascimento, setNascimento] = useState('');
  const [end, setEnd] = useState({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });
  const [erroEnd, setErroEnd] = useState<string | null>(null);
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
    if (exigeDocumento(metodo) && !documento.trim()) {
      // Boleto sem documento faz o gateway recusar o pedido inteiro — e a
      // pessoa perde junto o cartão e o Pix na mesma recusa.
      setErroDoc('Para pagar no boleto, informe o CPF ou CNPJ.');
      refDoc.current?.focus();
      return;
    }
    const enderecoCompleto =
      cepValido(end.cep) &&
      end.logradouro.trim().length >= 2 &&
      end.numero.trim().length >= 1 &&
      end.bairro.trim().length >= 2 &&
      end.cidade.trim().length >= 2 &&
      ufValida(end.uf);

    if (metodo === 'boleto' && !enderecoCompleto) {
      // Boleto sem endereço é recusado pelo gateway, e a recusa derruba o
      // pedido inteiro — a pessoa perde junto o cartão e o Pix.
      setErroEnd('Para pagar no boleto, informe o endereço completo.');
      return;
    }
    if (nascimento && !dataDeNascimentoValida(nascimento)) {
      setErroEnd('Data de nascimento inválida.');
      return;
    }
    if (!enderecoCompleto && (end.cep || end.logradouro || end.cidade)) {
      // Endereço pela metade não ajuda o gateway e engana quem preencheu.
      setErroEnd('Complete o endereço ou deixe todos os campos em branco.');
      return;
    }

    try {
      const r = await startCheckout.mutateAsync({
        productId: product.id,
        metodo,
        couponCode:
          validation.kind === 'ok' ? validation.data.coupon.code : undefined,
        name: nome.trim(),
        document: documento,
        birthDate: nascimento || undefined,
        endereco: enderecoCompleto
          ? {
              cep: end.cep,
              logradouro: end.logradouro.trim(),
              numero: end.numero.trim(),
              complemento: end.complemento.trim() || undefined,
              bairro: end.bairro.trim(),
              cidade: end.cidade.trim(),
              uf: end.uf.toUpperCase() as UF,
            }
          : undefined,
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor={`${idDoc}-nasc`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              Nascimento
            </label>
            <input
              id={`${idDoc}-nasc`}
              type="date"
              value={nascimento}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setNascimento(e.target.value);
                setErroEnd(null);
              }}
              className="pco-input text-sm mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`${idDoc}-cep`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              CEP{metodo === 'boleto' ? '' : ' (opcional)'}
            </label>
            <input
              id={`${idDoc}-cep`}
              value={end.cep}
              inputMode="numeric"
              maxLength={9}
              placeholder="00000-000"
              autoComplete="postal-code"
              onChange={(e) => {
                setEnd({ ...end, cep: formatarCep(e.target.value) });
                setErroEnd(null);
              }}
              className="pco-input text-sm font-mono mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <div>
            <label
              htmlFor={`${idDoc}-rua`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              Endereço
            </label>
            <input
              id={`${idDoc}-rua`}
              value={end.logradouro}
              autoComplete="address-line1"
              placeholder="Rua, avenida..."
              onChange={(e) => {
                setEnd({ ...end, logradouro: e.target.value });
                setErroEnd(null);
              }}
              className="pco-input text-sm mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`${idDoc}-num`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              Número
            </label>
            <input
              id={`${idDoc}-num`}
              value={end.numero}
              placeholder="123"
              onChange={(e) => {
                setEnd({ ...end, numero: e.target.value });
                setErroEnd(null);
              }}
              className="pco-input text-sm mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
          <div>
            <label
              htmlFor={`${idDoc}-bairro`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              Bairro
            </label>
            <input
              id={`${idDoc}-bairro`}
              value={end.bairro}
              autoComplete="address-level3"
              onChange={(e) => {
                setEnd({ ...end, bairro: e.target.value });
                setErroEnd(null);
              }}
              className="pco-input text-sm mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`${idDoc}-cidade`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              Cidade
            </label>
            <input
              id={`${idDoc}-cidade`}
              value={end.cidade}
              autoComplete="address-level2"
              onChange={(e) => {
                setEnd({ ...end, cidade: e.target.value });
                setErroEnd(null);
              }}
              className="pco-input text-sm mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`${idDoc}-uf`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              UF
            </label>
            <select
              id={`${idDoc}-uf`}
              value={end.uf}
              autoComplete="address-level1"
              onChange={(e) => {
                setEnd({ ...end, uf: e.target.value });
                setErroEnd(null);
              }}
              className="pco-input text-sm mt-1"
            >
              <option value="">--</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erroEnd && (
          <p className="text-xs text-status-danger flex items-center gap-1">
            <AlertCircle size={10} />
            {erroEnd}
          </p>
        )}

        <fieldset>
          <legend className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Como você quer pagar
          </legend>
          <div className="grid gap-1.5">
            {METODOS_PAGAMENTO.map((m) => (
              <label
                key={m}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm ${
                  metodo === m
                    ? 'border-pco-blue bg-pco-blue/5 text-pco-deep'
                    : 'border-surface-line text-ink-muted'
                }`}
              >
                <input
                  type="radio"
                  name={`${uid}-metodo`}
                  value={m}
                  checked={metodo === m}
                  onChange={() => setMetodo(m)}
                  className="accent-pco-blue"
                />
                <span>{ROTULO_METODO[m]}</span>
                {exigeDocumento(m) && (
                  <span className="text-[11px] text-ink-subtle ml-auto">exige CPF</span>
                )}
                {/*
                  Aqui não se anuncia número de parcelas.
                  O diálogo do app não consulta o roteamento, e o número real
                  depende de qual gateway serve o método — dizer "12x" sem essa
                  consulta seria repetir, numa tela nova, o defeito que a
                  vitrine acabou de perder. As condições ficam com a vitrine e
                  com a página do gateway, que sabem.
                */}
              </label>
            ))}
          </div>
        </fieldset>

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
