import { JsonStore } from '../db/json-store';

/**
 * As tentativas de avaliação, que até 6/set/2026 não existiam.
 *
 * ## O que havia antes
 *
 * `POST /me/quiz/:courseId/grade` corrigia a prova, calculava a nota, devolvia
 * `passed` e **não gravava nada**. Nem a nota, nem a data, nem o fato de ter
 * havido uma tentativa.
 *
 * Consequências, e nenhuma delas aparece como erro:
 *
 * - A escola **não conseguia responder se alguém foi avaliado**. Não havia
 *   registro para nenhum aluno, em nenhum curso, desde sempre.
 * - O aluno não via o próprio histórico: fechou a aba, perdeu a nota.
 * - Ninguém podia refazer o certificado sobre desempenho, mesmo querendo — não
 *   havia dado. E o certificado sai de contagem de cliques em aula
 *   obrigatória, o que torna esta lacuna a razão técnica de a outra existir.
 * - O `/me/export` da LGPD não entregava as avaliações porque não havia o que
 *   entregar.
 *
 * ## Duas decisões que qualquer mexida aqui tem de respeitar
 *
 * **O texto da resposta dissertativa NÃO é guardado.** O que fica é o resultado
 * por questão: acertou, não acertou, ou ficou pendente de correção. O registro
 * existe para provar que houve avaliação e com que desempenho — guardar o que a
 * pessoa escreveu aumenta a superfície de dado pessoal sem servir a essa
 * finalidade. Se um dia a escola precisar da redação para recurso, isso é uma
 * decisão nova, com retenção declarada.
 *
 * **Toda tentativa é gravada, inclusive a reprovada e a repetida.** Guardar só
 * a melhor apagaria o histórico de esforço, que é o dado de que a coordenação
 * precisa para enxergar quem está travado. `melhorDe()` calcula a melhor na
 * hora de exibir.
 */

export interface QuizAttempt {
  id: string;
  userId: string;
  courseId: string;
  /** Módulo avaliado, quando a prova é de módulo. `null` = prova do curso. */
  moduleId: string | null;
  /** Percentual obtido, 0–100. */
  pct: number;
  /** Nota de corte que valia **no momento da tentativa**. */
  passingScore: number;
  passed: boolean;
  /** Questões que entraram na nota. */
  total: number;
  /** Acertos entre elas. */
  acertos: number;
  /** Questões que ficaram sem correção (IA indisponível). */
  pendentes: number;
  /**
   * Resultado por questão — sem o texto da resposta.
   *
   * `correct: null` é "não foi possível corrigir", que é diferente de errou:
   * ela não entrou no denominador da nota.
   */
  questoes: Array<{ questionId: string; correct: boolean | null }>;
  createdAt: string;
}

const store = new JsonStore<QuizAttempt>('quiz-attempts.json', () => []);

function novoId(): string {
  return `qa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function registrar(input: {
  userId: string;
  courseId: string;
  moduleId?: string | null;
  pct: number;
  passingScore: number;
  passed: boolean;
  total: number;
  acertos: number;
  pendentes: number;
  questoes: Array<{ questionId: string; correct: boolean | null }>;
}): Promise<QuizAttempt> {
  const attempt: QuizAttempt = {
    id: novoId(),
    userId: input.userId,
    courseId: input.courseId,
    moduleId: input.moduleId ?? null,
    pct: input.pct,
    passingScore: input.passingScore,
    passed: input.passed,
    total: input.total,
    acertos: input.acertos,
    pendentes: input.pendentes,
    questoes: input.questoes,
    createdAt: new Date().toISOString(),
  };
  return await store.unshift(attempt);
}

/** Tudo o que esta pessoa fez, do mais recente para o mais antigo. */
export async function listForUser(userId: string): Promise<QuizAttempt[]> {
  const all = await store.getAll();
  return all
    .filter((a) => a.userId === userId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

/** As tentativas de uma pessoa num curso. */
export async function listForUserAndCourse(
  userId: string,
  courseId: string,
): Promise<QuizAttempt[]> {
  return (await listForUser(userId)).filter((a) => a.courseId === courseId);
}

/** Todas as tentativas de um curso — para a coordenação. */
export async function listForCourse(courseId: string): Promise<QuizAttempt[]> {
  const all = await store.getAll();
  return all
    .filter((a) => a.courseId === courseId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

/**
 * A melhor tentativa de um módulo, ou `null` se nunca houve.
 *
 * **`null` é "nunca tentou"**, e não "tirou zero" — a distinção importa para
 * qualquer regra que venha a se apoiar nisto: reprovar quem não fez é outra
 * decisão, e tem de ser tomada por quem a escreve, não herdada de um zero
 * inventado aqui.
 */
export function melhorDe(attempts: QuizAttempt[], moduleId: string | null): QuizAttempt | null {
  const doModulo = attempts.filter((a) => (a.moduleId ?? null) === (moduleId ?? null));
  if (doModulo.length === 0) return null;
  return doModulo.reduce((melhor, a) => (a.pct > melhor.pct ? a : melhor));
}

/** Apaga as tentativas de um titular. Usado pelo expurgo da LGPD. */
export async function clearForUser(userId: string): Promise<number> {
  // `modify` em vez de `getAll` + `setAll`: o par perde escrita concorrente
  // ocorrida entre as duas chamadas.
  return await store.modify((items) => {
    const antes = items.length;
    const restantes = items.filter((a) => a.userId !== userId);
    items.length = 0;
    items.push(...restantes);
    return antes - items.length;
  });
}
