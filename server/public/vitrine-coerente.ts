/**
 * A página do curso não pode se contradizer na mesma tela.
 *
 * ## O caso, medido em 9/set/2026
 *
 * A página do carro-chefe anuncia, num chip do topo, **19 módulos** — número
 * contado dos módulos reais do curso. Logo abaixo, em "Conteúdo do curso", ela
 * lista **15**. Quem lê a página inteira antes de comprar vê os dois.
 *
 * A causa não é erro de contagem: são **duas fontes**. Os chips saem dos
 * `modules` do curso; a grade sai de `curriculum`, um campo editorial digitado
 * à mão no admin. Os dois começaram iguais e divergiram quando o curso ganhou
 * módulos e ninguém voltou para atualizar o texto.
 *
 * O efeito é o de sempre neste projeto: **nada dá erro**. A página responde
 * 200, os dois números estão lá, e quatro módulos que o aluno compra
 * simplesmente não aparecem no lugar em que ele decide comprar.
 *
 * ## O que isto NÃO faz
 *
 * Não corrige a grade, e não deve: a redação de cada linha é editorial e é do
 * dono. O que se afirma aqui é só que os dois números precisam bater.
 *
 * **E não olha `totalHours`**, embora ele também seja digitado à mão (560 no
 * carro-chefe). Comparar com a duração somada das aulas daria alarme falso: a
 * maioria delas ainda carrega o placeholder de 15 minutos da importação, e o
 * resolvedor de duração se recusa, corretamente, a inventar valor para aula
 * sem vídeo. Enquanto a base de durações não for real, uma comparação aqui
 * mediria o placeholder, não a carga do curso.
 */
import * as coursesRepo from '../repositories/courses';
import { isPubliclyListed } from '../../shared/visibilidade';

export interface GradeDivergente {
  courseId: string;
  titulo: string;
  /** Módulos que o curso tem de verdade. */
  modulos: number;
  /** Itens que a grade publicada mostra. */
  naGrade: number;
}

export interface CoerenciaDaVitrine {
  /** Cursos públicos cuja grade não bate com os módulos. */
  divergentes: GradeDivergente[];
  /** Quantos cursos públicos foram conferidos. `0` = não havia o que conferir. */
  conferidos: number;
  /** Preenchido quando **não deu para olhar** — nunca confundir com "está tudo certo". */
  erro: string | null;
}

/**
 * Confere se a grade publicada de cada curso público cobre os módulos dele.
 *
 * Nunca lança: quem chama é painel de saúde.
 */
export async function conferirGrades(): Promise<CoerenciaDaVitrine> {
  let cursos: Awaited<ReturnType<typeof coursesRepo.listCourses>>;
  try {
    cursos = await coursesRepo.listCourses();
  } catch (err) {
    return {
      divergentes: [],
      conferidos: 0,
      erro: err instanceof Error ? err.message : String(err),
    };
  }

  const divergentes: GradeDivergente[] = [];
  let conferidos = 0;

  for (const c of cursos) {
    // Só o que está na vitrine: é onde a contradição custa uma venda. Curso
    // interno divergente é problema de catálogo, não de página de compra.
    if (!isPubliclyListed(c as never)) continue;
    const grade = (c as unknown as { curriculum?: unknown[] }).curriculum ?? [];
    // Curso SEM grade não conta como divergente: a seção inteira não aparece
    // na página, e isso é omissão deliberada, não contradição. Alarmar aqui
    // encheria o painel com os três cursos que nunca tiveram ementa escrita.
    if (!Array.isArray(grade) || grade.length === 0) continue;
    conferidos++;
    const modulos = (c.modules ?? []).length;
    if (grade.length !== modulos) {
      divergentes.push({
        courseId: c.id,
        titulo: c.title ?? c.id,
        modulos,
        naGrade: grade.length,
      });
    }
  }

  return { divergentes, conferidos, erro: null };
}
