import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Eye, Layers, Clock, PlayCircle } from 'lucide-react';
import { useCourses } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export default function AdminCoursePreview() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: courses = [], isLoading } = useCourses();
  useDocumentMeta({ title: 'Preview do curso — Admin' });

  if (isLoading) return <CardListSkeleton count={3} />;
  const course = courses.find((c) => c.id === courseId);
  if (!course) return <Navigate to="/admin/cursos" replace />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 border-pco-orange/40 bg-pco-orange/5 p-3 flex items-start gap-2 text-xs">
        <Eye size={14} className="text-pco-orange shrink-0 mt-0.5" strokeWidth={1.75} />
        <div>
          <strong className="text-pco-deep">Modo preview:</strong> renderização do curso
          como o aluno vê. Progresso, certificados e cliques NÃO afetam dados reais.
          <Link
            to={`/admin/cursos/${course.id}`}
            className="ml-2 text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={11} strokeWidth={2} />
            Voltar para o editor
          </Link>
        </div>
      </div>

      <header>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-pco-blue">
          Curso · preview
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-pco-deep">{course.title}</h1>
        <p className="mt-2 text-sm text-ink-muted max-w-2xl">{course.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Layers size={13} strokeWidth={1.75} className="text-pco-blue" />
            {course.modules.length} módulos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} strokeWidth={1.75} className="text-pco-blue" />
            {course.totalHours}h
          </span>
        </div>
        {course.tags && course.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {course.tags.map((t) => (
              <span
                key={t}
                className="pco-badge bg-pco-blue/10 text-pco-blue text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <section>
        <h2 className="pco-section-title">Módulos</h2>
        <div className="space-y-3">
          {course.modules.map((module, i) => (
            <div
              key={module.id}
              className="pco-card flex items-center gap-4 cursor-not-allowed opacity-90"
              title="Preview — clique desativado"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 grid place-items-center font-bold text-pco-deep">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-pco-deep">{module.title}</h3>
                <p className="text-xs text-ink-muted line-clamp-1">
                  {module.description}
                </p>
                <div className="mt-1 text-[11px] text-ink-subtle">
                  {module.lessons.length} aulas
                </div>
              </div>
              <PlayCircle size={20} className="text-pco-blue shrink-0" strokeWidth={1.75} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="pco-section-title">Aulas (achatado)</h2>
        <div className="pco-card p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-mute text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Módulo</th>
                <th className="text-left px-3 py-2">Aula</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {course.modules.flatMap((m, mi) =>
                m.lessons.map((l, li) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-ink-subtle">
                      {mi + 1}.{li + 1}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{m.title}</td>
                    <td className="px-3 py-2 text-pco-deep">{l.title}</td>
                    <td className="px-3 py-2">
                      <span className="pco-badge bg-surface-gray text-ink-muted">
                        {l.status ?? 'available'}
                      </span>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
