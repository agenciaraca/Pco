import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Jornada from '../src/app/pages/Jornada';

/**
 * `Jornada` usava `useCourses()` cru — o CATÁLOGO inteiro, publicamente
 * listado, matriculado ou não — para o seletor de curso e para o padrão
 * mostrado. Um aluno matriculado em UM curso via o outro na "sua jornada",
 * podia selecioná-lo e clicar "Iniciar módulo" para dentro dele.
 *
 * Relatado pelo dono em 11/set/2026: *"quando seleciona a jornada do aluno,
 * aparece o de terapia familiar e inicia por lá... o aluno acessa um curso
 * que ele não está inscrito"*.
 *
 * O conteúdo real de aula continua protegido por `courseAccessFor` no
 * servidor — isto não é vazamento de material pago, é a tela mentir sobre
 * qual curso é "seu".
 */

const pronta = {
  data: undefined as unknown,
  error: null,
  isPending: false,
  isLoading: false,
  isError: false,
  fetchStatus: 'idle' as const,
  refetch: () => {},
};

function curso(id: string, title: string) {
  return {
    id,
    slug: id,
    title,
    shortTitle: title,
    description: '',
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 1,
    certificateAvailable: false,
    modules: [
      {
        id: `m-${id}`,
        courseId: id,
        title: `Módulo 1 de ${title}`,
        description: '',
        order: 1,
        lessons: [
          {
            id: `l-${id}`,
            courseId: id,
            moduleId: `m-${id}`,
            title: 'Aula 1',
            durationMinutes: 10,
            order: 1,
            isMandatory: false,
          },
        ],
      },
    ],
  };
}

const CURSO_MEU = curso('c-meu', 'Curso de Psicanálise Clínica');
const CURSO_ALHEIO = curso('c-terapia-familiar', 'Terapia Familiar Sistêmica');

const mocks = vi.hoisted(() => ({
  courses: [] as unknown[],
  enrolledCourseIds: [] as string[],
}));

vi.mock('../src/app/data/hooks', () => ({
  useCourses: () => ({ ...pronta, data: mocks.courses }),
  useCurrentStudent: () => ({ ...pronta, data: { enrolledCourseIds: mocks.enrolledCourseIds } }),
  useMyProgress: () => ({ data: { completedLessonIds: [] } }),
}));

function montar() {
  return render(
    <MemoryRouter>
      <Jornada />
    </MemoryRouter>,
  );
}

describe('a jornada só oferece curso em que o aluno está matriculado', () => {
  it('curso do catálogo em que o aluno NÃO está matriculado não aparece', () => {
    mocks.courses = [CURSO_MEU, CURSO_ALHEIO];
    mocks.enrolledCourseIds = ['c-meu'];
    montar();
    expect(screen.getByText('Módulo 1 de Curso de Psicanálise Clínica')).toBeInTheDocument();
    expect(screen.queryByText('Terapia Familiar Sistêmica')).not.toBeInTheDocument();
    expect(screen.queryByText('Módulo 1 de Terapia Familiar Sistêmica')).not.toBeInTheDocument();
  });

  it('o padrão exibido é o curso matriculado, mesmo que o alheio venha primeiro na API', () => {
    mocks.courses = [CURSO_ALHEIO, CURSO_MEU]; // alheio em primeiro no array
    mocks.enrolledCourseIds = ['c-meu'];
    montar();
    expect(screen.getByText('Módulo 1 de Curso de Psicanálise Clínica')).toBeInTheDocument();
  });

  it('zero cursos matriculados mostra "sem curso", nunca um curso do catálogo por padrão', () => {
    mocks.courses = [CURSO_MEU, CURSO_ALHEIO];
    mocks.enrolledCourseIds = [];
    montar();
    expect(screen.getByText(/não tem curso matriculado/i)).toBeInTheDocument();
    expect(screen.queryByText('Curso de Psicanálise Clínica')).not.toBeInTheDocument();
    expect(screen.queryByText('Terapia Familiar Sistêmica')).not.toBeInTheDocument();
  });
});
