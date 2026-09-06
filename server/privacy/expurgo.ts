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

import { createHash } from 'node:crypto';
import * as usersStore from '../auth/users-store';
import * as studentsRepo from '../repositories/students';
import * as progressRepo from '../repositories/progress';
import * as quizAttempts from '../repositories/quiz-attempts';
import * as lessonNotesRepo from '../repositories/lesson-notes';
import * as podcastEngagementRepo from '../repositories/podcast-engagement';
import * as tutorHistory from '../repositories/tutor-history';
import * as ordersRepo from '../payments/orders-repo';
import * as bookingsRepo from '../sessions/bookings-repo';
import * as supportRepo from '../repositories/support';
import * as notificationsRepo from '../repositories/notifications';
import * as achievementsStore from '../achievements/store';
import * as watchTimeRepo from '../repositories/watch-time';
import * as discussions from '../discussions/store';
import * as forum from '../forum/store';
import * as courseReviews from '../reviews/store';
import * as retentionRepo from '../repositories/retention';
import * as adminNotes from '../admin/notes-store';
import * as recoveryPlans from '../repositories/recovery-plans';
import * as emailLogs from '../notifications/log-store';
import * as auditLog from '../audit/log';

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
      'a guardar, e a obrigação fiscal é de cinco anos. ATENÇÃO: o pedido retido guarda o ' +
      'e-mail do titular em texto claro e o mesmo id de conta — a anonimização da conta NÃO ' +
      'o alcança. Quem responder ao titular precisa dizer isso, e não que os dados foram ' +
      'todos removidos.',
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
    categoria: 'forum',
    destino: 'anonimizar',
    // Categoria separada de `forumAndComments` porque são dois stores, e
    // juntá-los sob um nome só foi exatamente como o fórum ficou de fora das
    // duas pontas por meses: `forumAndComments` lia apenas os comentários de
    // aula. Nome plausível cobrindo metade é pior do que nome faltando.
  },
  {
    categoria: 'courseReviews',
    destino: 'anonimizar',
    // A nota entra na média que os outros leem; sumir com ela reescreve um
    // número público por causa de um pedido individual.
  },
  {
    categoria: 'emailLogs',
    destino: 'apagar',
    // `to` é o endereço da pessoa e `subject` diz o que a escola comunicou a
    // ela. A fila continuava contando isso depois de a conta ser anonimizada.
  },
  {
    categoria: 'auditLog',
    destino: 'reter',
    motivo:
      'Registro de segurança: é o que prova o que a escola fez com os dados desta pessoa — ' +
      'inclusive que este expurgo foi executado, por quem e quando. Apagá-lo destruiria a ' +
      'evidência da própria exclusão, e a retenção de log de segurança é interesse legítimo ' +
      '(LGPD art. 7º, IX, e art. 16, II).',
  },
  {
    categoria: 'quizAttempts',
    destino: 'apagar',
    // Desempenho em avaliação é dado da pessoa, e não vale para terceiro: o
    // certificado, que é o que fica para o mundo, é retido à parte.
  },
  { categoria: 'retentionRisk', destino: 'apagar' },
  { categoria: 'adminNotesAboutMe', destino: 'apagar' },
  { categoria: 'recoveryPlans', destino: 'apagar' },
];

/** O que substitui o dado pessoal na anonimização. */
function marcaAnonima(userId: string): { nome: string; email: string } {
  /*
    O sufixo precisa ser **estável** — duas execuções do expurgo da mesma
    pessoa não podem criar dois "titulares removidos" diferentes no que sobrou,
    e o e-mail é único na tabela.
    Estável não quer dizer *derivado por recorte*: a primeira versão usava
    `userId.slice(-6)`, e aí o próprio pseudônimo carregava seis caracteres do
    identificador que a anonimização existe para dissociar. Um hash resolve as
    duas coisas.
  */
  const curto = createHash('sha256').update(userId).digest('hex').slice(0, 10);
  return { nome: 'Titular removido', email: `removido-${curto}@invalido.local` };
}

/*
  `contar` **não** engole exceção, e isso já foi bug.

  A primeira versão tinha `try { ... } catch { return []; }`. Um store fora do
  ar produzia `encontrados: 0` **sem** `erro`, e `completo` (que é
  "nenhum item com erro") dizia `true`. No ensaio, portanto, "não consegui
  olhar" era impresso exatamente como "não havia nada" — e o operador lia isso
  antes de autorizar a execução.

  É a regra que este projeto já escreveu para as telas de métrica: zero diz
  "medi e não houve"; não medir tem de aparecer como não medido. Quem trata o
  erro é `registra`, que o grava no item e derruba `completo`.
*/
async function contar<T>(fn: () => Promise<T[]>): Promise<T[]> {
  return await fn();
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

  /*
    **O e-mail é lido aqui, antes de qualquer coisa.**

    A fila de envios é chaveada pelo endereço, não pelo `userId` — quem escreve
    ali é o remetente, que só conhece o e-mail. E a categoria `user`, logo
    abaixo, **troca** esse endereço pela marca anônima. Lendo depois, a busca
    procuraria por `removido-...@invalido.local` e não acharia nada: o relatório
    diria "0 encontrados" sobre uma fila cheia.
  */
  const email = (await usersStore.findUserById(userId))?.email ?? null;

  await registra(
    d('user'),
    async () => ((await usersStore.findUserById(userId)) ? 1 : 0),
    async () => {
      // `anonimizarConta`, e não `updateUser`: o CPF, o hash de senha e a
      // semente de 2FA não são alcançáveis pelo caminho de CRUD do admin.
      const ok = await usersStore.anonimizarConta(userId, marcaAnonima(userId));
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

  const marca = marcaAnonima(userId);

  await registra(
    d('sessionBookings'),
    async () => (await contar(() => bookingsRepo.listForUser(userId))).length,
    async () => await bookingsRepo.anonimizarParaUsuario(userId),
  );

  await registra(
    d('supportTickets'),
    async () => (await contar(() => supportRepo.listTicketsForStudent(userId))).length,
    async () => await supportRepo.clearForUser(userId),
  );

  await registra(
    d('notifications'),
    async () => (await contar(() => notificationsRepo.listForUser(userId, 100_000))).length,
    async () => await notificationsRepo.clearForUser(userId),
  );

  await registra(
    d('achievements'),
    async () => (await contar(() => achievementsStore.listForUser(userId))).length,
    async () => await achievementsStore.clearForUser(userId),
  );

  await registra(
    d('watchTime'),
    async () => (await contar(() => watchTimeRepo.listForUser(userId))).length,
    async () => await watchTimeRepo.clearForUser(userId),
  );

  await registra(
    d('forumAndComments'),
    async () =>
      (await contar(() => discussions.listAll())).filter((x) => x.authorId === userId).length,
    async () => await discussions.anonimizarParaUsuario(userId, marca),
  );

  await registra(
    d('forum'),
    async () => {
      const { threads, replies } = await forum.listForUser(userId);
      return threads.length + replies.length;
    },
    async () => await forum.anonimizarParaUsuario(userId, marca),
  );

  await registra(
    d('courseReviews'),
    async () =>
      (await contar(() => courseReviews.listAll())).filter((x) => x.userId === userId).length,
    async () => await courseReviews.anonimizarParaUsuario(userId, marca),
  );

  await registra(
    d('quizAttempts'),
    async () => (await contar(() => quizAttempts.listForUser(userId))).length,
    async () => await quizAttempts.clearForUser(userId),
  );

  await registra(
    d('emailLogs'),
    async () => (email ? (await emailLogs.listForEmail(email)).length : 0),
    async () => (email ? await emailLogs.clearForEmail(email) : 0),
  );

  await registra(
    d('auditLog'),
    // Retido: `registra` nem chama a rotina quando o destino é `reter`. O que
    // se mede aqui é quanto existe, para o relatório dizer o que fica.
    async () => (await auditLog.listAudit({ targetId: userId, limit: 1000 })).length,
    async () => 0,
  );

  await registra(
    d('retentionRisk'),
    async () =>
      (await contar(() => retentionRepo.listRetentionRisks())).filter(
        (x) => x.studentId === userId,
      ).length,
    async () => await retentionRepo.clearForUser(userId),
  );

  await registra(
    d('adminNotesAboutMe'),
    async () => (await contar(() => adminNotes.listForStudent(userId))).length,
    async () => await adminNotes.clearForUser(userId),
  );

  await registra(
    d('recoveryPlans'),
    async () => (await contar(() => recoveryPlans.listForStudent(userId))).length,
    async () => await recoveryPlans.clearForUser(userId),
  );

  return {
    userId,
    executou: commit,
    itens,
    completo: itens.every((i) => !i.erro),
  };
}
