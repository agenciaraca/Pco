/**
 * "Esta pessoa pode entrar na plataforma?" — decidido num lugar só.
 *
 * Regra vigente desde 30/ago/2026, a pedido do dono: **ninguém entra sem ter
 * comprado**. Conta existir não é mais o bastante; é preciso ter matrícula ou
 * um pedido pago.
 *
 * Por que aqui e não dentro do `/auth/login`: existem **cinco** portas que
 * emitem sessão — senha, senha com 2FA, Google, Microsoft e SAML. Guardar só a
 * primeira transforma o bloqueio em teatro, e é exatamente a forma como as
 * oito rotas de admin ficaram abertas em agosto (ver `attachUser` no
 * CLAUDE.md): a leitura ficou sem a guarda que a escrita tinha.
 *
 * ## O que conta como "comprou"
 *
 * **Matrícula, mesmo vencida.** Prazo expirado não pode virar porta trancada:
 * quem venceu precisa entrar justamente para renovar. `courseAccessFor`
 * continua barrando a aula — são perguntas diferentes, e confundi-las tira o
 * acesso de quem quer voltar a pagar.
 *
 * **Qualquer pedido pago.** Cobre quem comprou só sessão de análise ou
 * supervisão e não tem curso nenhum. Sem isso, a pessoa paga e não entra —
 * o pior resultado possível para uma regra que existe para proteger a receita.
 *
 * **Os 1.601 alunos vindos da migração entram**, porque têm matrícula. O
 * pagamento deles aconteceu no sistema antigo e não existe como pedido aqui;
 * exigir pedido pago trancaria a maior parte de quem pagou de verdade.
 *
 * ## Quem nunca é barrado
 *
 * Admin e superadmin. Eles não têm matrícula por definição, e barrá-los
 * tirancaria a própria pessoa que precisa consertar a regra.
 */

import * as studentsRepo from '../repositories/students';
import * as ordersRepo from '../payments/orders-repo';

export type MotivoBloqueio = 'sem_matricula';

export interface ResultadoPortao {
  pode: boolean;
  motivo: MotivoBloqueio | null;
}

const LIBERADO: ResultadoPortao = { pode: true, motivo: null };

/**
 * A regra está ligada?
 *
 * Ligada por padrão — foi pedida como estado normal, não como experimento.
 * `EXIGIR_MATRICULA_PARA_ENTRAR=false` desliga sem publicar código, porque o
 * dono disse "por enquanto" e a volta atrás não pode depender de um deploy.
 */
export function portaoAtivo(): boolean {
  return process.env.EXIGIR_MATRICULA_PARA_ENTRAR !== 'false';
}

/** Mensagem mostrada a quem é barrado. Diz o que fazer, não só que não pode. */
export const MENSAGEM_SEM_MATRICULA =
  'Sua conta existe, mas ainda não há nenhuma matrícula ligada a ela. ' +
  'Conclua a compra de um curso para liberar o acesso. Se você já pagou, ' +
  'fale com a gente que a gente regulariza.';

/**
 * Decide a entrada de um usuário já autenticado.
 *
 * Recebe o usuário porque as cinco portas chegam aqui de formas diferentes
 * (senha, ticket de 2FA, provedor externo) e todas já têm o registro em mãos.
 */
export async function podeEntrar(usuario: {
  id: string;
  role: string;
}): Promise<ResultadoPortao> {
  if (!portaoAtivo()) return LIBERADO;
  if (usuario.role === 'admin' || usuario.role === 'superadmin') return LIBERADO;

  const ficha = await studentsRepo.findAdminStudent(usuario.id).catch(() => null);
  const matriculas = ficha?.enrolledCourseIds ?? [];
  if (matriculas.length > 0) return LIBERADO;

  // Falha ABERTA de propósito: se a consulta de pedidos quebrar, deixamos
  // entrar. Uma indisponibilidade do repositório não pode virar porta trancada
  // para quem pagou — o prejuízo de barrar um cliente legítimo é maior que o de
  // deixar entrar alguém sem compra num ambiente que, sem matrícula, está vazio.
  const pedidos = await ordersRepo.listForUser(usuario.id).catch(() => null);
  if (pedidos === null) return LIBERADO;
  if (pedidos.some((p) => p.status === 'paid')) return LIBERADO;

  return { pode: false, motivo: 'sem_matricula' };
}
