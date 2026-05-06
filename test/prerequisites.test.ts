import { describe, it, expect } from 'vitest';
import {
  checkPrerequisites,
  computeCompletedCourseIds,
} from '../server/repositories/prerequisites';

describe('checkPrerequisites', () => {
  it('curso sem prereq → ok=true', () => {
    expect(checkPrerequisites(undefined, [])).toEqual({
      ok: true,
      missing: [],
      status: [],
    });
    expect(checkPrerequisites([], ['c1', 'c2'])).toEqual({
      ok: true,
      missing: [],
      status: [],
    });
  });

  it('todos os prereqs completos → ok=true', () => {
    const r = checkPrerequisites(['c1', 'c2'], ['c1', 'c2', 'c3']);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.status).toEqual([
      { courseId: 'c1', completed: true },
      { courseId: 'c2', completed: true },
    ]);
  });

  it('alguns prereqs faltando → ok=false com lista missing', () => {
    const r = checkPrerequisites(['c1', 'c2', 'c3'], ['c1']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['c2', 'c3']);
    expect(r.status).toEqual([
      { courseId: 'c1', completed: true },
      { courseId: 'c2', completed: false },
      { courseId: 'c3', completed: false },
    ]);
  });

  it('nenhum prereq completo → todos missing', () => {
    const r = checkPrerequisites(['c1', 'c2'], []);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['c1', 'c2']);
  });
});

describe('computeCompletedCourseIds', () => {
  const courses = [
    {
      id: 'c1',
      modules: [{ lessons: [{ id: 'l1' }, { id: 'l2' }] }],
    },
    {
      id: 'c2',
      modules: [
        { lessons: [{ id: 'l3' }] },
        { lessons: [{ id: 'l4' }, { id: 'l5' }] },
      ],
    },
    {
      id: 'c3-empty',
      modules: [],
    },
  ];

  it('retorna courses com 100% das aulas concluídas', () => {
    expect(computeCompletedCourseIds(courses, ['l1', 'l2'])).toEqual(['c1']);
    expect(computeCompletedCourseIds(courses, ['l1', 'l2', 'l3', 'l4', 'l5'])).toEqual([
      'c1',
      'c2',
    ]);
  });

  it('curso parcial não conta', () => {
    expect(computeCompletedCourseIds(courses, ['l1', 'l3'])).toEqual([]);
    expect(computeCompletedCourseIds(courses, ['l1', 'l2', 'l3'])).toEqual(['c1']);
  });

  it('curso sem aulas é ignorado', () => {
    expect(computeCompletedCourseIds(courses, [])).toEqual([]);
  });

  it('lessons completed não-relacionadas não atrapalham', () => {
    expect(
      computeCompletedCourseIds(courses, ['l1', 'l2', 'l-other-course']),
    ).toEqual(['c1']);
  });
});
