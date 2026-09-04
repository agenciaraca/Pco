import { type ReactNode } from 'react';
import { WifiOff, AlertTriangle, SearchX } from 'lucide-react';

/**
 * Os três estados que quase nenhuma tela deste produto distinguia.
 *
 * A auditoria de 3/set/2026 encontrou **76 arquivos** que usam `isLoading` e
 * não têm `isError` em lugar nenhum. O efeito varia pela tela, e nenhuma
 * variação é boa:
 *
 * - **Redirecionamento silencioso** (`LMSCourse`, `LMSModule`,
 *   `LMSAssessment`, `Quiz`): o padrão era `if (isLoading) <skeleton>` e
 *   depois `if (!course) <Navigate to="/cursos" />`. Servidor fora do ar ou
 *   internet caída não é nenhum dos dois, então a execução chegava ao
 *   `Navigate` e o aluno era **jogado para fora da aula sem uma palavra** —
 *   parecendo que o curso sumiu da estante dele.
 * - **Esqueleto infinito** (`AdminVendas`, `AdminSaude`, `AdminRateLimits`):
 *   a animação de carregamento fica girando para sempre. Quem olha conclui que
 *   o sistema está lento, e não que a requisição morreu.
 * - **Painel que some** (`AdminDashboard`): três blocos simplesmente não
 *   aparecem, e a tela parece completa sem eles.
 *
 * ## Por que `isPending`, e não `isLoading`
 *
 * No TanStack Query v5, requisição feita sem conexão fica com
 * `fetchStatus: 'paused'`. Nesse estado **`isLoading` é `false`** — ele é
 * `isPending && isFetching`, e nada está sendo buscado — e `isError` também é
 * `false`, porque não houve erro: a requisição nem partiu. Uma tela que só
 * conhece `isLoading` e "tem dado?" trata o aluno offline como aluno sem
 * direito.
 *
 * `isPending` significa "ainda não tenho dado", que é a pergunta que a tela de
 * fato precisa fazer. E `fetchStatus === 'paused'` merece texto próprio, porque
 * "sem internet" e "o servidor falhou" pedem ações diferentes de quem lê.
 *
 * ## Uso
 *
 * ```tsx
 * const q = useCourses();
 * if (q.fetchStatus === 'paused') return <SemConexao />;
 * if (q.isPending) return <CardListSkeleton count={3} />;
 * if (q.isError) return <FalhaAoCarregar erro={q.error} aoTentarDeNovo={() => void q.refetch()} />;
 * ```
 *
 * A ordem importa: `paused` antes de `isPending`, porque estar offline também
 * é estar pendente, e a mensagem específica é mais útil que a genérica.
 */

function Cartao({
  icone,
  titulo,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-10">
      <div className="pco-card max-w-md text-center p-6">
        <div className="mx-auto h-10 w-10 rounded-xl bg-surface-gray grid place-items-center mb-3">
          {icone}
        </div>
        <h2 className="text-base font-bold text-pco-deep">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** Sem rede. A informação que muda o que a pessoa faz é "o problema é aqui". */
export function SemConexao({ oQue = 'esta página' }: { oQue?: string }) {
  return (
    <Cartao
      icone={<WifiOff className="text-ink-subtle" size={18} strokeWidth={1.5} />}
      titulo="Sem conexão"
    >
      <p className="text-sm text-ink-muted mt-2">
        Não consegui falar com o servidor para carregar {oQue}. Assim que a
        internet voltar, ela carrega sozinha.
      </p>
    </Cartao>
  );
}

/**
 * A requisição partiu e falhou.
 *
 * **Sempre com botão de tentar de novo.** Erro sem saída obriga a pessoa a
 * recarregar a página inteira e perder o que estava fazendo — e num editor de
 * curso isso é trabalho perdido.
 */
export function FalhaAoCarregar({
  erro,
  aoTentarDeNovo,
  oQue = 'esta página',
}: {
  erro?: unknown;
  aoTentarDeNovo?: () => void;
  oQue?: string;
}) {
  return (
    <Cartao
      icone={<AlertTriangle className="text-status-danger" size={18} strokeWidth={1.5} />}
      titulo={`Não consegui carregar ${oQue}`}
    >
      <p className="text-sm text-ink-muted mt-2">
        {erro instanceof Error && erro.message
          ? erro.message
          : 'A conexão falhou ou o servidor não respondeu.'}
      </p>
      {aoTentarDeNovo && (
        <button type="button" onClick={aoTentarDeNovo} className="pco-btn-primary text-sm mt-4">
          Tentar de novo
        </button>
      )}
    </Cartao>
  );
}

/**
 * Carregou, e o que se procurava não está ali.
 *
 * **Este é o único caso em que a tela pode dizer "não encontrei"** — e mesmo
 * aqui ela não afirma que a coisa não existe, porque não sabe: há 418 contas em
 * produção com login e sem ficha de aluno, e para elas o catálogo não devolve
 * as matrículas que a pessoa de fato tem. Dizer "este curso não existe" a quem
 * pagou por ele manda embora justamente quem precisa de ajuda.
 */
export function NaoEncontrado({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <Cartao
      icone={<SearchX className="text-ink-subtle" size={18} strokeWidth={1.5} />}
      titulo={titulo}
    >
      {children && <div className="text-sm text-ink-muted mt-2">{children}</div>}
      {acao && <div className="flex gap-2 justify-center mt-4 flex-wrap">{acao}</div>}
    </Cartao>
  );
}
