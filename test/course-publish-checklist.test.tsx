import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CoursePublishChecklist from '../src/app/components/CoursePublishChecklist';
import type { Course } from '../src/app/types/schema';

function makeCourse(overrides: Partial<Course> = {}): Course {
  const base: Course = {
    id: 'c-test',
    slug: 'curso-teste',
    title: 'Curso Teste',
    shortTitle: 'Teste',
    description: 'Descrição genérica curta.',
    coverColor: 'from-pco-blue to-pco-cyan',
    modules: [],
    totalHours: 0,
    certificateAvailable: false,
  };
  return { ...base, ...overrides };
}

describe('CoursePublishChecklist', () => {
  it('curso vazio: ~10-20% completo', () => {
    const { getByText } = render(
      <CoursePublishChecklist course={makeCourse({ description: '' })} />,
    );
    // título+slug ✓; resto pendente
    expect(getByText(/de 10 items/)).toBeInTheDocument();
  });

  it('curso 100% completo: 100%', () => {
    const full = makeCourse({
      description: 'a'.repeat(60),
      modules: [
        {
          id: 'm1',
          courseId: 'c-test',
          title: 'M1',
          order: 1,
          lessons: [
            {
              id: 'l1',
              moduleId: 'm1',
              courseId: 'c-test',
              title: 'L1',
              durationMinutes: 5,
              isMandatory: true,
              order: 1,
              isPreview: true,
            },
            {
              id: 'l2',
              moduleId: 'm1',
              courseId: 'c-test',
              title: 'L2',
              durationMinutes: 5,
              isMandatory: true,
              order: 2,
            },
            {
              id: 'l3',
              moduleId: 'm1',
              courseId: 'c-test',
              title: 'L3',
              durationMinutes: 5,
              isMandatory: true,
              order: 3,
            },
          ],
        },
      ],
      totalHours: 4,
      instructorName: 'Dr. Teste',
      learningOutcomes: ['a', 'b', 'c'],
      tags: ['x'],
      certificateAvailable: true,
    });
    const { getByText } = render(<CoursePublishChecklist course={full} />);
    expect(getByText('100%')).toBeInTheDocument();
    expect(getByText('10 de 10 items recomendados')).toBeInTheDocument();
  });

  it('descrição < 50 chars não conta', () => {
    const { container } = render(
      <CoursePublishChecklist
        course={makeCourse({ description: 'curtinho' })}
      />,
    );
    // Procurar texto da hint que aparece em items pendentes
    expect(container.textContent).toContain('Mínimo 50 chars');
  });

  it('mostra hints só em pendentes', () => {
    const partial = makeCourse({
      description: 'a'.repeat(60),
      instructorName: 'X',
    });
    const { container } = render(<CoursePublishChecklist course={partial} />);
    // descrição e instrutor são "done" — hints não devem aparecer
    expect(container.textContent).not.toContain('Mínimo 50 chars');
    expect(container.textContent).not.toContain('credibilidade');
    // Tags ainda pendente — hint não vem (não tem hint)
  });

  it('barra de progresso muda cor em 100%', () => {
    const full = makeCourse({
      description: 'a'.repeat(60),
      modules: [
        {
          id: 'm1',
          courseId: 'c-test',
          title: 'M',
          order: 1,
          lessons: [
            { id: 'l1', moduleId: 'm1', courseId: 'c-test', title: 'L1', durationMinutes: 1, isMandatory: true, order: 1, isPreview: true },
            { id: 'l2', moduleId: 'm1', courseId: 'c-test', title: 'L2', durationMinutes: 1, isMandatory: true, order: 2 },
            { id: 'l3', moduleId: 'm1', courseId: 'c-test', title: 'L3', durationMinutes: 1, isMandatory: true, order: 3 },
          ],
        },
      ],
      totalHours: 1,
      instructorName: 'X',
      learningOutcomes: ['a', 'b', 'c'],
      tags: ['x'],
      certificateAvailable: true,
    });
    const { container } = render(<CoursePublishChecklist course={full} />);
    expect(container.querySelector('.bg-status-success')).toBeTruthy();
  });
});
