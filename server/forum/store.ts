// Forum por curso: threads + replies. Storage simples JSON.
//
// Threads:
//   - id, courseId, authorId, title, body, kind, status, createdAt, updatedAt
//   - kind: 'pergunta' | 'dica' | 'discussao'
//   - status: 'aberta' | 'resolvida' | 'arquivada'
//   - reactions: { likes: number, likedBy: string[] }
//
// Replies:
//   - id, threadId, authorId, body, createdAt
//   - isAccepted? (resposta marcada pelo autor da pergunta)
//
// Não é federado nem realtime — admin modera, pulling normal.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export type ThreadKind = 'pergunta' | 'dica' | 'discussao';
export type ThreadStatus = 'aberta' | 'resolvida' | 'arquivada';

export interface ForumThread {
  id: string;
  courseId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  kind: ThreadKind;
  status: ThreadStatus;
  reactions: { likes: number; likedBy: string[] };
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumReply {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  isAccepted: boolean;
  reactions: { likes: number; likedBy: string[] };
  createdAt: string;
}

const threadsStore = new JsonStore<ForumThread>('forum-threads.json', () => []);
const repliesStore = new JsonStore<ForumReply>('forum-replies.json', () => []);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listThreads(courseId: string): Promise<ForumThread[]> {
  const all = await threadsStore.getAll();
  return all
    .filter((t) => t.courseId === courseId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getThread(id: string): Promise<ForumThread | null> {
  return await threadsStore.findOne((t) => t.id === id);
}

export async function listReplies(threadId: string): Promise<ForumReply[]> {
  const all = await repliesStore.getAll();
  return all
    .filter((r) => r.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createThread(input: {
  courseId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  kind: ThreadKind;
}): Promise<ForumThread> {
  const now = new Date().toISOString();
  const thread: ForumThread = {
    id: newId('th'),
    courseId: input.courseId,
    authorId: input.authorId,
    authorName: input.authorName,
    title: input.title,
    body: input.body,
    kind: input.kind,
    status: 'aberta',
    reactions: { likes: 0, likedBy: [] },
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await threadsStore.unshift(thread);
  return thread;
}

export async function createReply(input: {
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<ForumReply | null> {
  const thread = await getThread(input.threadId);
  if (!thread) return null;
  const now = new Date().toISOString();
  const reply: ForumReply = {
    id: newId('rp'),
    threadId: input.threadId,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.body,
    isAccepted: false,
    reactions: { likes: 0, likedBy: [] },
    createdAt: now,
  };
  await repliesStore.unshift(reply);
  await threadsStore.update(
    (t) => t.id === input.threadId,
    (t) => ({ ...t, replyCount: t.replyCount + 1, updatedAt: now }),
  );
  return reply;
}

export async function likeThread(id: string, userId: string): Promise<ForumThread | null> {
  return await threadsStore.update(
    (t) => t.id === id,
    (t) => {
      const liked = t.reactions.likedBy.includes(userId);
      if (liked) {
        return {
          ...t,
          reactions: {
            likes: Math.max(0, t.reactions.likes - 1),
            likedBy: t.reactions.likedBy.filter((u) => u !== userId),
          },
        };
      }
      return {
        ...t,
        reactions: {
          likes: t.reactions.likes + 1,
          likedBy: [...t.reactions.likedBy, userId],
        },
      };
    },
  );
}

export async function likeReply(id: string, userId: string): Promise<ForumReply | null> {
  return await repliesStore.update(
    (r) => r.id === id,
    (r) => {
      const liked = r.reactions.likedBy.includes(userId);
      if (liked) {
        return {
          ...r,
          reactions: {
            likes: Math.max(0, r.reactions.likes - 1),
            likedBy: r.reactions.likedBy.filter((u) => u !== userId),
          },
        };
      }
      return {
        ...r,
        reactions: {
          likes: r.reactions.likes + 1,
          likedBy: [...r.reactions.likedBy, userId],
        },
      };
    },
  );
}

export async function markThreadResolved(
  id: string,
  resolved: boolean,
): Promise<ForumThread | null> {
  return await threadsStore.update(
    (t) => t.id === id,
    (t) => ({
      ...t,
      status: resolved ? 'resolvida' : 'aberta',
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function markReplyAccepted(
  id: string,
  accepted: boolean,
): Promise<ForumReply | null> {
  return await repliesStore.update(
    (r) => r.id === id,
    (r) => ({ ...r, isAccepted: accepted }),
  );
}

export async function deleteThread(id: string): Promise<boolean> {
  // Apaga thread + todas as replies
  const ok = await threadsStore.modify((rows) => {
    const idx = rows.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  });
  if (ok) {
    await repliesStore.modify((rows) => {
      const remaining = rows.filter((r) => r.threadId !== id);
      rows.length = 0;
      rows.push(...remaining);
      return undefined;
    });
  }
  return ok;
}

/**
 * Uma resposta pelo id. Existe porque `DELETE /forum/replies/:id` precisava
 * saber de quem era antes de apagar — e não sabia: até 27/ago/2026 qualquer
 * aluno autenticado apagava a resposta de qualquer pessoa, em qualquer curso.
 * As duas rotas vizinhas (excluir e resolver thread) sempre checaram autor ou
 * admin; esta ficou de fora.
 */
export async function getReply(id: string): Promise<ForumReply | null> {
  return await repliesStore.findOne((r) => r.id === id);
}

export async function deleteReply(id: string): Promise<boolean> {
  const reply = await repliesStore.findOne((r) => r.id === id);
  if (!reply) return false;
  await repliesStore.modify((rows) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx !== -1) rows.splice(idx, 1);
    return undefined;
  });
  await threadsStore.update(
    (t) => t.id === reply.threadId,
    (t) => ({ ...t, replyCount: Math.max(0, t.replyCount - 1) }),
  );
  return true;
}

/**
 * Tudo o que o titular escreveu no fórum — para a exportação e para o expurgo.
 *
 * O fórum ficou **fora das duas pontas** até 5/set/2026, e o motivo de ninguém
 * ter notado é instrutivo: a categoria chamava-se `forumAndComments` e era
 * alimentada só por `discussions` (comentário de aula, `lesson-comments.json`).
 * Nome plausível, conteúdo pela metade. E o teste que compara a exportação com
 * o expurgo passava — porque as duas listas erravam junto.
 */
export async function listForUser(
  userId: string,
): Promise<{ threads: ForumThread[]; replies: ForumReply[] }> {
  const [threads, replies] = await Promise.all([threadsStore.getAll(), repliesStore.getAll()]);
  return {
    threads: threads.filter((t) => t.authorId === userId),
    replies: replies.filter((r) => r.authorId === userId),
  };
}

/**
 * Anonimiza autoria e retira o titular das curtidas.
 *
 * A pergunta e a resposta continuam de pé — elas são conteúdo do curso para
 * quem veio depois, e apagar a pergunta arrancaria também a resposta do
 * professor. O que sai é o vínculo: `authorId`, `authorName` e a presença do
 * id em `likedBy` de conteúdo **de terceiros** — este último é o que se
 * esquece, porque é dado do titular guardado em linha que não é dele.
 */
export async function anonimizarParaUsuario(
  userId: string,
  marca: { nome: string },
): Promise<number> {
  const anonimo = `anon-${userId.slice(-8)}`;
  let tocados = 0;

  const varrer = <T extends { authorId: string; authorName: string; reactions: { likes: number; likedBy: string[] } }>(
    items: T[],
  ): number => {
    let n = 0;
    for (const x of items) {
      let mexeu = false;
      if (x.authorId === userId) {
        x.authorId = anonimo;
        x.authorName = marca.nome;
        mexeu = true;
      }
      if (x.reactions.likedBy.includes(userId)) {
        x.reactions.likedBy = x.reactions.likedBy.filter((u) => u !== userId);
        // `likes` acompanha: o número é a contagem de quem curtiu, e ficaria
        // um a mais do que a lista para sempre.
        x.reactions.likes = x.reactions.likedBy.length;
        mexeu = true;
      }
      if (mexeu) n += 1;
    }
    return n;
  };

  tocados += await threadsStore.modify(varrer);
  tocados += await repliesStore.modify(varrer);
  return tocados;
}
