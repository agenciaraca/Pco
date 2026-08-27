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
 * ## O que ficou público, e por quê
 *
 * O catálogo continua devolvendo título, descrição, duração, ordem e
 * obrigatoriedade de cada aula. Isso é a **ementa**, e ementa vende: sem ela o
 * visitante não sabe o que está comprando. O que sai é `content`, e só ele.
 *
 * ## Onde o aluno pega o conteúdo
 *
 * `GET /me/courses/:courseId/lessons/:lessonId/content`, que passa por
 * `courseAccessFor` — matrícula **e** prazo de acesso. Aula marcada como
 * preview continua livre pela rota que já existia (`/lessons/:id/preview`):
 * essa é teaser de marketing, e é deliberada.
 */

/**
 * Assinaturas propositalmente estruturais: este módulo não deve depender do
 * tipo `Course`, senão qualquer campo novo no curso obrigaria a mexer aqui — e
 * o que ele faz é uma coisa só, tirar `content` de dentro das aulas.
 */
type ComAulas = { lessons?: unknown[] };
type ComModulos = { modules?: ComAulas[] };

function aulaSemCorpo(l: unknown): unknown {
  if (!l || typeof l !== 'object' || !('content' in l)) return l;
  const { content: _corpo, ...resto } = l as { content?: unknown };
  return resto;
}

/**
 * Devolve o curso sem o corpo das aulas.
 *
 * Remove a chave em vez de esvaziá-la: `content: ''` faria a tela do aluno
 * cair no ramo "sem conteúdo" e mostrar a descrição como se fosse a aula,
 * enquanto a ausência é o mesmo estado de uma aula que nunca teve corpo.
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
