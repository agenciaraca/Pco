// O expurgo de dados do titular — LGPD, art. 18, VI.
//
// ## O que existia antes
//
// Marcar a solicitação como `completed` gravava um campo e uma nota. **Nada era
// apagado em lugar nenhum.** Não havia rotina de expurgo, não havia rota de
// exclusão de usuário, e `deleteUser()` existia no store sem nenhum chamador. A
// escola dizia ao titular que a exclusão estava concluída e guardava tudo.
//
// ## A regra que orienta este arquivo
//
// **O que a exportação entrega é o que o expurgo tem de tratar.** As duas
// respondem à mesma pergunta — "o que vocês guardam sobre mim?" — e não podem
// discordar: categoria que sai no `/me/export` e não aparece aqui é dado que a
// escola admite ter e não sabe apagar. `test/expurgo-cobre-o-que-exporta.test.ts`
// compara as duas listas e falha se divergirem.
//
// ## Três destinos, e a diferença entre eles importa
//
// - **`apagar`** — a linha some. É o padrão.
// - **`anonimizar`** — a linha fica, sem ligação com a pessoa. É o destino de
//   quando o registro tem valor para outra pessoa ou para a escola: um
//   comentário no fórum apagado deixa a resposta de outro aluno sem pergunta;
//   uma avaliação de curso apagada muda a média que os outros leem.
// - **`reter`** — a linha fica inteira, **e isso é decisão jurídica, não
//   técnica**. Pedido pago é documento fiscal: a LGPD (art. 16, I) manda
//   guardar o que outra lei obriga a guardar, e a obrigação fiscal é de cinco
//   anos. Apagar um pedido pago para atender ao titular criaria um problema
//   maior do que resolve.
//
// `reter` sempre vem com o motivo escrito. Retenção sem justificativa é
// retenção indevida.

import * as usersStore from '../auth/users-store';
import * as studentsRepo from '../repositories/students';
import * as progressRepo from '../repositories/progress';
import * as lessonNotesRepo from '../repositories/lesson-notes';
import * as podcastEngagementRepo from '../repositories/podcast-engagement';
import * as tutorHistory from '../repositories/tutor-history';
import * as ordersRepo from '../payments/orders-repo';

export type Destino = 'apagar' | 'anonimizar' | 'reter';

export interface DecisaoDeCategoria {
  /** A mesma chave que a categoria tem em `/me/export`. */
  categoria: string;
  destino: Destino;
  /** Obrigatório em `reter`: por que a escola continua guardando. */
  motivo?: string;
}

export interface ItemDoExpurgo extends DecisaoDeCategoria {
  /** Quantos registros o expurgo encontrou para esta pessoa. */
  encontrados: number;
  /** Quantos foram efetivamente tratados. Zero em ensaio. */
  tratados: number;
  erro?: string;
}

export interface ResultadoDoExpurgo {
  userId: string;
  /** Houve `commit`? Sem ele nada é tocado. */
  executou: boolean;
  itens: ItemDoExpurgo[];
  /** Toda categoria foi tratada sem erro? */
  completo: boolean;
}

/**
 * O destino de cada categoria da exportação.
 *
 * A lista é comparada com a do `/me/export` por teste. Categoria nova de dado
 * pessoal entra nos dois lugares — ou o expurgo passa a mentir por omissão.
 */
export const DECISOES: DecisaoDeCategoria[] = [
  // `exportedAt` é carimbo do arquivo, não dado guardado.
  { categoria: 'exportedAt', destino: 'apagar' },
  {
    categoria: 'user',
    destino: 'anonimizar',
    // Apagar a conta quebraria as linhas que apontam para ela — pedido pago,
    // certificado emitido, log de auditoria. Anonimizar corta o vínculo com a
    // pessoa e preserva a integridade do que precisa ficar.
  },
  { categoria: 'student', destino: 'anonimizar' },
  { categoria: 'progress', destino: 'apagar' },
  { categoria: 'lessonNotes', destino: 'apagar' },
  { categoria: 'podcastEngagement', destino: 'apagar' },
  { categoria: 'tutorHistory', destino: 'apagar' },
  {
    categoria: 'certificates',
    destino: 'reter',
    motivo:
      'Certificado emitido é declaração da escola a terceiros, com código de validação ' +
      'público. Apagá-lo invalidaria a conferência de quem o recebeu.',
  },
  {
    categoria: 'orders',
    destino: 'reter',
    motivo:
      'Pedido pago é documento fiscal. LGPD art. 16, I: guarda-se o que outra lei obriga ' +
      'a guardar, e a obrigação fiscal é de cinco anos.',
  },
  { categoria: 'sessionBookings', destino: 'anonimizar' },
  { categoria: 'supportTickets', destino: 'apagar' },
  { categoria: 'notifications', destino: 'apagar' },
  { categoria: 'achievements', destino: 'apagar' },
  { categoria: 'watchTime', destino: 'apagar' },
  {
    categoria: 'forumAndComments',
    destino: 'anonimizar',
    // Apagar deixaria a resposta de outro aluno sem a pergunta que a motivou.
  },
  {
    categoria: 'courseReviews',
    destino: 'anonimizar',
    // A nota entra na média que os outros leem; sumir com ela reescreve um
    // número público por causa de um pedido individual.
  },
  { categoria: 'retentionRisk', destino: 'apagar' },
  { categoria: 'adminNotesAboutMe', destino: 'apagar' },
  { categoria: 'recoveryPlans', destino: 'apagar' },
];

/** O que substitui o dado pessoal na anonimização. */
function marcaAnonima(userId: string): { nome: string; email: string } {
  // Sufixo estável e derivado do id: duas anonimizações da mesma pessoa não
  // criam dois "titulares" diferentes no que sobrou.
  const curto = userId.slice(-6);
  return { nome: 'Titular removido', email: `removido-${curto}@invalido.local` };
}

async function contar<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

/**
 * Executa (ou ensaia) o expurgo de um titular.
 *
 * **Sem `commit: true` não toca em nada** — devolve o mesmo relatório dizendo o
 * que faria e quantos registros encontrou. É a operação mais destrutiva do
 * sistema; o ensaio não é conveniência, é a única forma de alguém conferir
 * antes.
 */
export async function expurgarTitular(
  userId: string,
  opts: { commit?: boolean } = {},
): Promise<ResultadoDoExpurgo> {
  const commit = Boolean(opts.commit);
  const itens: ItemDoExpurgo[] = [];

  const registra = async (
    decisao: DecisaoDeCategoria,
    encontrar: () => Promise<number>,
    tratar: () => Promise<number>,
  ) => {
    try {
      const encontrados = await encontrar();
      const tratados = commit && decisao.destino !== 'reter' ? await tratar() : 0;
      itens.push({ ...decisao, encontrados, tratados });
    } catch (err) {
      itens.push({
        ...decisao,
        encontrados: 0,
        tratados: 0,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const porCategoria = new Map(DECISOES.map((d) => [d.categoria, d]));
  const d = (c: string): DecisaoDeCategoria => porCategoria.get(c)!;

  // Carimbo do arquivo: não há o que apagar, e declarar isso é melhor do que
  // omitir a categoria e deixar a comparação com a exportação incompleta.
  itens.push({ ...d('exportedAt'), encontrados: 0, tratados: 0 });

  await registra(
    d('user'),
    async () => ((await usersStore.findUserById(userId)) ? 1 : 0),
    async () => {
      const marca = marcaAnonima(userId);
      const ok = await usersStore.updateUser(userId, {
        name: marca.nome,
        email: marca.email,
        active: false,
      });
      return ok ? 1 : 0;
    },
  );

  await registra(
    d('student'),
    async () => ((await studentsRepo.findAdminStudent(userId)) ? 1 : 0),
    async () => {
      const marca = marcaAnonima(userId);
      const ok = await studentsRepo.updateAdminStudent(userId, {
        name: marca.nome,
        email: marca.email,
      } as never);
      return ok ? 1 : 0;
    },
  );

  await registra(
    d('progress'),
    async () => (await contar(() => progressRepo.listForUser(userId))).length,
    async () => await progressRepo.clearForUser(userId),
  );

  await registra(
    d('lessonNotes'),
    async () => (await contar(() => lessonNotesRepo.listForUser(userId))).length,
    async () => await lessonNotesRepo.clearForUser(userId),
  );

  await registra(
    d('podcastEngagement'),
    async () => (await contar(() => podcastEngagementRepo.listForUser(userId))).length,
    async () => await podcastEngagementRepo.clearForUser(userId),
  );

  await registra(
    d('tutorHistory'),
    async () => (await contar(() => tutorHistory.listForUser(userId, 100_000))).length,
    async () => await tutorHistory.clearForUser(userId),
  );

  // Retidos: contam-se para o relatório, e não se toca.
  await registra(
    d('certificates'),
    async () => 0,
    async () => 0,
  );
  await registra(
    d('orders'),
    async () => (await contar(() => ordersRepo.listForUser(userId))).length,
    async () => 0,
  );

  // As categorias abaixo ainda não têm rotina de limpeza no repositório delas.
  // Declará-las com `encontrados: -1` seria inventar; o honesto é registrar o
  // erro, que derruba `completo` e impede a solicitação de virar "concluída".
  for (const categoria of [
    'sessionBookings',
    'supportTickets',
    'notifications',
    'achievements',
    'watchTime',
    'forumAndComments',
    'courseReviews',
    'retentionRisk',
    'adminNotesAboutMe',
    'recoveryPlans',
  ]) {
    itens.push({
      ...d(categoria),
      encontrados: 0,
      tratados: 0,
      erro: 'sem rotina de expurgo no repositório desta categoria',
    });
  }

  return {
    userId,
    executou: commit,
    itens,
    completo: itens.every((i) => !i.erro),
  };
}
