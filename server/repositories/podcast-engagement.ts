// Engagement do aluno com podcasts — listened/favorite por (userId, episodeId).

import { JsonStore } from '../db/json-store';

export interface PodcastEngagement {
  userId: string;
  episodeId: string;
  listened: boolean;
  favorite: boolean;
  updatedAt: string;
}

const store = new JsonStore<PodcastEngagement>('podcast-engagement.json', () => []);

export async function listForUser(userId: string): Promise<PodcastEngagement[]> {
  return await store.filter((e) => e.userId === userId);
}

export async function get(
  userId: string,
  episodeId: string,
): Promise<PodcastEngagement | null> {
  return await store.findOne((e) => e.userId === userId && e.episodeId === episodeId);
}

export async function upsert(
  userId: string,
  episodeId: string,
  patch: { listened?: boolean; favorite?: boolean },
): Promise<PodcastEngagement> {
  const now = new Date().toISOString();
  const existing = await get(userId, episodeId);
  if (existing) {
    return (await store.update(
      (e) => e.userId === userId && e.episodeId === episodeId,
      (e) => ({ ...e, ...patch, updatedAt: now }),
    ))!;
  }
  const entry: PodcastEngagement = {
    userId,
    episodeId,
    listened: patch.listened ?? false,
    favorite: patch.favorite ?? false,
    updatedAt: now,
  };
  await store.unshift(entry);
  return entry;
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
