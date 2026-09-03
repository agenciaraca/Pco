import { CheckCircle2, Circle } from 'lucide-react';
import type { Course } from '../types/schema';

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
}

/**
 * Painel lateral mostrando o quão pronto pra publicação está o curso.
 * Cada item é uma característica recomendada antes de marketing público.
 */
export default function CoursePublishChecklist({
  course,
}: {
  course: Course;
}) {
  const items: ChecklistItem[] = [
    {
      key: 'title',
      label: 'Título e slug definidos',
      done: course.title.trim().length >= 3 && course.slug.trim().length >= 2,
    },
    {
      key: 'description',
      label: 'Descrição completa',
      done: (course.description?.trim().length ?? 0) >= 50,
      hint: 'Mínimo 50 chars — ajuda SEO e conversão',
    },
    {
      key: 'modules',
      label: 'Pelo menos 1 módulo',
      done: course.modules.length >= 1,
    },
    {
      key: 'lessons',
      label: 'Pelo menos 3 aulas no total',
      done:
        course.modules.reduce((s, m) => s + m.lessons.length, 0) >= 3,
    },
    {
      key: 'totalHours',
      label: 'Carga horária preenchida',
      done: course.totalHours > 0,
    },
    {
      key: 'instructor',
      label: 'Instrutor identificado',
      done: !!course.instructorName?.trim(),
      hint: 'Adiciona credibilidade ao curso',
    },
    {
      key: 'outcomes',
      label: '"O que você vai aprender" preenchido',
      done: (course.learningOutcomes?.length ?? 0) >= 3,
      hint: 'Recomendado: 4-8 bullets',
    },
    {
      key: 'tags',
      label: 'Tags pra catálogo',
      done: (course.tags?.length ?? 0) >= 1,
    },
    {
      key: 'preview',
      label: 'Pelo menos 1 aula com preview livre',
      done: course.modules.some((m) =>
        m.lessons.some((l) => l.isPreview),
      ),
      hint: 'Aumenta conversão de visitantes não-matriculados',
    },
    {
      key: 'cert',
      label: 'Certificado configurado',
      done: course.certificateAvailable,
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <aside className="pco-card p-4 space-y-3 sticky top-4">
      <header>
        <h3 className="text-sm font-semibold text-pco-deep">
          Pronto pra publicar
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-mute rounded-full overflow-hidden">
            <div
              className={`h-full ${
                pct === 100
                  ? 'bg-status-success'
                  : 'bg-gradient-to-r from-pco-blue to-pco-cyan'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-pco-deep tabular-nums">
            {pct}%
          </span>
        </div>
        <p className="text-xs text-ink-subtle mt-1">
          {completed} de {total} items recomendados
        </p>
      </header>

      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.key} className="flex items-start gap-2">
            {it.done ? (
              <CheckCircle2
                size={14}
                className="text-status-success shrink-0 mt-0.5"
                strokeWidth={2}
              />
            ) : (
              <Circle
                size={14}
                className="text-ink-subtle shrink-0 mt-0.5"
                strokeWidth={2}
              />
            )}
            <div className="flex-1 min-w-0">
              <span
                className={`text-xs ${
                  it.done ? 'text-ink-muted line-through' : 'text-ink-strong'
                }`}
              >
                {it.label}
              </span>
              {it.hint && !it.done && (
                <div className="text-xs text-ink-subtle mt-0.5">
                  {it.hint}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
