// Anotações pessoais do aluno por aula — data/lesson-notes.json.
// Uma entry por par (userId, lessonId).

import { JsonStore } from '../db/json-store';

export interface LessonNote {
  userId: string;
  lessonId: string;
  content: string;
  updatedAt: string;
}

const store = new JsonStore<LessonNote>('lesson-notes.json', () => []);

export async function getNote(userId: string, lessonId: string): Promise<LessonNote | null> {
  return await store.findOne((n) => n.userId === userId && n.lessonId === lessonId);
}

export async function listForUser(userId: string): Promise<LessonNote[]> {
  return await store.filter((n) => n.userId === userId);
}

export async function upsertNote(
  userId: string,
  lessonId: string,
  content: string,
): Promise<LessonNote> {
  const now = new Date().toISOString();
  const existing = await getNote(userId, lessonId);
  if (existing) {
    return (await store.update(
      (n) => n.userId === userId && n.lessonId === lessonId,
      (n) => ({ ...n, content, updatedAt: now }),
    ))!;
  }
  const entry: LessonNote = { userId, lessonId, content, updatedAt: now };
  await store.unshift(entry);
  return entry;
}

export async function deleteNote(userId: string, lessonId: string): Promise<boolean> {
  return await store.remove((n) => n.userId === userId && n.lessonId === lessonId);
}

/**
 * Apaga tudo desta pessoa. Usado pelo expurgo de dados (LGPD, art. 18, VI).
 *
 * Devolve quantos registros saíram — o expurgo precisa do número para dizer o
 * que fez, e "0 apagados" é resposta diferente de "não consegui".
 */
export async function clearForUser(userId: string): Promise<number> {
  /*
    `modify` em vez de `getAll` + `setAll`.

    `getAll` devolve a lista viva, mas o par lê, monta um array novo fora dela e
    o instala com `setAll`. Entre as duas chamadas há `await`: qualquer escrita
    concorrente no mesmo store — um aviso novo, um progresso de aula — entra na
    lista viva e é jogada fora pelo `setAll`, sem erro nenhum. `modify` faz a
    volta inteira em cima da lista viva, sem janela entre ler e gravar.
  */
  return await store.modify((items) => {
    const antes = items.length;
    const restantes = items.filter((x) => x.userId !== userId);
    items.length = 0;
    items.push(...restantes);
    return antes - items.length;
  });
}
