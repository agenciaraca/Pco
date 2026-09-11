/**
 * O corpo da aula — o produto que a escola vende.
 *
 * ## O buraco que este arquivo fecha
 *
 * `GET /api/courses` é público (é o catálogo, e precisa ser). Até
 * 27/ago/2026 ele devolvia o curso **inteiro**, e `listCourses()` inclui
 * `lesson.content`. Ou seja: um `curl` sem token nenhum baixava o HTML
 * completo de todas as aulas de todos os cursos.
 *
 * Em produção isso são os 2,93 milhões de caracteres que a migration 0008 e o
 * `restaurar_conteudo_aulas.ts` recuperaram — a apostila inteira, de graça,
 * para quem soubesse a URL. Não era conteúdo de demonstração: era o material
 * pelo qual o aluno paga.
 *
 * ## E o vídeo, que ficou de fora por mais uma semana
 *
 * `content` saiu em 27/ago; `videoUrl` continuou saindo até 2/set/2026. Para
 * um curso feito de podcasts gravados — o Treinamento PCO é isso — **o vídeo é
 * o curso**: quem tinha a URL assistia inteiro sem matrícula, sem login e sem
 * pagar. Eram 105 URLs expostas nos quatro cursos ativos.
 *
 * ## O que ficou público, e por quê
 *
 * O catálogo continua devolvendo título, descrição, duração, ordem e
 * obrigatoriedade de cada aula. Isso é a **ementa**, e ementa vende: sem ela o
 * visitante não sabe o que está comprando. O que sai é o material: `content`,
 * `videoUrl` e `transcripts`.
 *
 * ## `transcripts` faltou aqui, e ficou faltando um ano-luz em silêncio
 *
 * A migration `0017` (3/set/2026) criou a coluna e o painel de três idiomas no
 * admin — a transcrição virou recurso de verdade, não só um campo do schema.
 * Esta função nasceu antes disso (27/ago) e nunca foi atualizada: ela só
 * conhecia `content` e `videoUrl`. Transcrição de aula É o material — texto em
 * vez de vídeo, protegido pela mesma regra —, e um `curl` sem token em
 * `GET /courses` ou `/courses/:id` devolvia a aula inteira em texto para quem
 * nunca pagou. Achado numa auditoria em 11/set/2026; medido em produção que a
 * exposição real era zero (nenhuma transcrição preenchida ainda), mas o
 * próximo uso do painel do admin a teria publicado sem deploy nenhum.
 *
 * ## Onde o aluno pega o conteúdo
 *
 * `GET /me/courses/:courseId/lessons/:lessonId/content`, que passa por
 * `courseAccessFor` — matrícula **e** prazo de acesso — e devolve o `content` e
 * o `videoUrl` juntos. Aula marcada como preview continua livre pela rota que
 * já existia (`/lessons/:id/preview`): essa é teaser de marketing, e é
 * deliberada.
 */

/**
 * Assinaturas propositalmente estruturais: este módulo não deve depender do
 * tipo `Course`, senão qualquer campo novo no curso obrigaria a mexer aqui — e
 * o que ele faz é uma coisa só, tirar `content` de dentro das aulas.
 */
type ComAulas = { lessons?: unknown[] };
type ComModulos = { modules?: ComAulas[] };

function aulaSemCorpo(l: unknown): unknown {
  if (!l || typeof l !== 'object') return l;
  if (!('content' in l) && !('videoUrl' in l) && !('transcripts' in l)) return l;
  const { content: _corpo, videoUrl: _video, transcripts: _transcricao, ...resto } = l as {
    content?: unknown;
    videoUrl?: unknown;
    transcripts?: unknown;
  };
  return resto;
}

/**
 * Devolve o curso sem o material das aulas: sem `content`, `videoUrl` e
 * `transcripts`.
 *
 * Remove a chave em vez de esvaziá-la: `content: ''` faria a tela do aluno
 * cair no ramo "sem conteúdo" e mostrar a descrição como se fosse a aula, e
 * `videoUrl: ''` faria a aula parecer não ter vídeo. A ausência é o mesmo
 * estado de uma aula que nunca teve nenhum dos três.
 *
 * `isPreview` é preservado — quem decide o teaser é a rota de preview.
 */
export function semConteudoDeAula<T extends ComModulos>(curso: T): T {
  if (!curso?.modules) return curso;
  return {
    ...curso,
    modules: curso.modules.map((m) => ({
      ...m,
      lessons: (m.lessons ?? []).map(aulaSemCorpo),
    })),
  } as T;
}

export function listaSemConteudoDeAula<T extends ComModulos>(cursos: T[]): T[] {
  return cursos.map(semConteudoDeAula);
}
