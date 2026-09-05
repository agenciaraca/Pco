import { useState } from 'react';
import { Route, AlertTriangle } from 'lucide-react';
import { useRoteamentoPagamento, useSalvarRotaPagamento } from '../data/hooks';
import { useToast } from './Toast';
import { SemConexao, FalhaAoCarregar } from './EstadosDeConsulta';
import { CardListSkeleton } from './LoadingSkeleton';
import { METODOS_PAGAMENTO, ROTULO_METODO } from '../../../shared/metodos-pagamento';
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';
import { ApiError } from '../data/client';

/**
 * Quem cobra cada método de pagamento.
 *
 * O que existia era `listActive()[0]` — o primeiro da lista de gateways —, e a
 * tela dizia, no singular, "apenas o gateway ativo é usado". Dois gateways
 * ativos ao mesmo tempo não davam erro nenhum: um recebia tudo, o outro nada, e
 * qual era qual dependia da ordem de cadastro. Como o cadastro entra no topo da
 * lista, criar um gateway novo e já ativo levava todas as vendas na hora.
 *
 * Aqui a escolha é explícita, por método, com um reserva opcional.
 *
 * **O seletor só oferece gateway que sabe cobrar aquele método** — o Stripe
 * deste código manda `payment_method_types[0] = 'card'` fixo, então ele não
 * aparece em boleto. Configuração impossível barrada aqui é venda que não morre
 * no checkout.
 */
export default function RoteamentoPagamento() {
  const q = useRoteamentoPagamento();
  const salvar = useSalvarRotaPagamento();
  const toast = useToast();
  const [salvando, setSalvando] = useState<MetodoPagamento | null>(null);

  if (q.fetchStatus === 'paused') return <SemConexao oQue="o roteamento de pagamento" />;
  if (q.isPending) return <CardListSkeleton count={1} />;
  if (q.isError)
    return (
      <FalhaAoCarregar
        erro={q.error}
        oQue="o roteamento de pagamento"
        aoTentarDeNovo={() => void q.refetch()}
      />
    );

  const { rotas, gateways } = q.data;
  const ativos = gateways.filter((g) => g.active);
  const nenhumaRota = rotas.every((r) => !r.principalId);

  async function trocar(
    metodo: MetodoPagamento,
    campo: 'principalId' | 'fallbackId',
    valor: string,
  ) {
    const rota = rotas.find((r) => r.metodo === metodo)!;
    const patch = {
      principalId: rota.principalId,
      fallbackId: rota.fallbackId,
      [campo]: valor || null,
    };
    setSalvando(metodo);
    try {
      await salvar.mutateAsync({ metodo, patch });
      toast.success(`${ROTULO_METODO[metodo]}: roteamento salvo`);
    } catch (err) {
      // O servidor recusa gateway que não cobra o método, e reserva igual ao
      // principal. A mensagem dele é específica; engoli-la deixaria o seletor
      // voltando sozinho ao valor antigo sem dizer por quê.
      toast.error(
        'Não deu para salvar',
        err instanceof ApiError ? err.message : 'Tente de novo em instantes.',
      );
    } finally {
      setSalvando(null);
    }
  }

  function opcoes(metodo: MetodoPagamento) {
    return ativos.filter((g) => g.metodos.includes(metodo));
  }

  return (
    <section className="pco-card p-5">
      <header className="flex items-start gap-3 mb-1">
        <div className="h-8 w-8 rounded-xl bg-surface-gray grid place-items-center shrink-0">
          <Route size={15} strokeWidth={1.75} className="text-pco-blue" />
        </div>
        <div>
          <h2 className="text-base font-bold text-pco-deep">Quem cobra cada método</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            O <strong>principal</strong> recebe a cobrança. O <strong>reserva</strong> só entra
            quando o principal recusa <strong>sem ter criado cobrança</strong> — se houver
            qualquer chance de a cobrança existir, o checkout para e conta o que houve, em vez de
            arriscar cobrar duas vezes.
          </p>
        </div>
      </header>

      {nenhumaRota && ativos.length > 1 && (
        <div className="mt-3 flex gap-2 items-start rounded-xl border border-status-warning/30 bg-status-warning/5 p-3 text-xs text-ink-muted">
          <AlertTriangle size={13} strokeWidth={1.75} className="text-status-warning mt-0.5 shrink-0" />
          <p>
            <strong className="text-pco-deep">
              {ativos.length} gateways ativos e nenhum roteamento.
            </strong>{' '}
            Enquanto ninguém escolher, quem cobra é o primeiro da lista — que é o{' '}
            <em>último cadastrado</em>, não uma decisão.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {METODOS_PAGAMENTO.map((metodo) => {
          const rota = rotas.find((r) => r.metodo === metodo)!;
          const disponiveis = opcoes(metodo);
          return (
            <div
              key={metodo}
              className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr] sm:items-center"
            >
              <span className="text-sm font-semibold text-pco-deep">
                {ROTULO_METODO[metodo]}
              </span>
              {disponiveis.length === 0 ? (
                <p className="text-xs text-ink-subtle italic sm:col-span-2">
                  Nenhum gateway ativo cobra {ROTULO_METODO[metodo].toLowerCase()}.
                </p>
              ) : (
                <>
                  <label className="block">
                    <span className="sr-only">Principal para {ROTULO_METODO[metodo]}</span>
                    <select
                      className="pco-input text-xs w-full"
                      value={rota.principalId ?? ''}
                      disabled={salvando === metodo}
                      onChange={(e) => void trocar(metodo, 'principalId', e.target.value)}
                    >
                      <option value="">Principal: não definido</option>
                      {disponiveis.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.displayName} ({g.mode})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="sr-only">Reserva para {ROTULO_METODO[metodo]}</span>
                    <select
                      className="pco-input text-xs w-full"
                      value={rota.fallbackId ?? ''}
                      disabled={salvando === metodo || !rota.principalId}
                      onChange={(e) => void trocar(metodo, 'fallbackId', e.target.value)}
                    >
                      <option value="">Reserva: nenhum</option>
                      {disponiveis
                        .filter((g) => g.id !== rota.principalId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.displayName} ({g.mode})
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
