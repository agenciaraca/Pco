import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, PlayCircle, Sparkles } from 'lucide-react';
import { useLessonPreview } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import Logo from '../components/Logo';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useAuth } from '../auth/AuthContext';

/**
 * Player público da lesson preview. Aberto a visitantes sem auth.
 * Mostra o vídeo + descrição + CTA pra matricular no curso.
 */
export default function LessonPreviewPublic() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, isError } = useLessonPreview(id);

  useDocumentMeta({
    title: data?.lesson.title
      ? `${data.lesson.title} — preview livre`
      : 'Aula preview — AVA PCO',
    description: data?.lesson.description,
  });

  if (isLoading) return <CardListSkeleton count={2} />;

  if (isError || !data) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <EmptyState
          title="Aula indisponível"
          description="Esta aula não está disponível como preview livre, ou o link está quebrado."
          icon={<BookOpen size={28} />}
        />
        <div className="text-center mt-4">
          <Link to="/catalogo" className="pco-btn-primary">
            Ver catálogo
          </Link>
        </div>
      </div>
    );
  }

  const { lesson, module, course } = data;

  // Aluno já logado pode ir direto pra rota normal
  if (user) {
    return <Navigate to={`/curso/${course.id}/modulo/${module.id}/aula/${lesson.id}`} replace />;
  }

  return (
    <div className="min-h-screen bg-surface-off">
      <header className="bg-white border-b border-pco-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to={`/curso-preview/${course.id}`}
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Ver curso completo
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <section>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pco-blue/10 text-pco-blue text-[10px] font-semibold uppercase tracking-wider">
            <PlayCircle size={10} strokeWidth={2.5} />
            Preview livre
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-pco-deep mt-2">
            {lesson.title}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            <span className="font-medium">{course.title}</span>
            <span className="mx-1.5 opacity-50">·</span>
            <span>{module.title}</span>
            <span className="mx-1.5 opacity-50">·</span>
            <Clock size={11} className="inline mr-0.5" strokeWidth={2} />
            {lesson.durationMinutes} min
          </p>
        </section>

        {lesson.videoUrl ? (
          <section className="aspect-video bg-black rounded-xl overflow-hidden">
            <video
              src={lesson.videoUrl}
              controls
              className="w-full h-full"
              preload="metadata"
            >
              Seu navegador não suporta o player de vídeo.
            </video>
          </section>
        ) : (
          <section className="aspect-video bg-gradient-to-br from-pco-deep to-pco-blue rounded-xl flex items-center justify-center text-white">
            <div className="text-center">
              <PlayCircle size={48} strokeWidth={1.5} />
              <p className="text-sm mt-3 opacity-80">
                Vídeo não publicado para esta aula.
              </p>
            </div>
          </section>
        )}

        {lesson.description && (
          <section className="pco-card p-5 prose prose-sm max-w-none text-ink-strong">
            <h3 className="text-base font-semibold text-pco-deep mb-2">Sobre esta aula</h3>
            <p className="whitespace-pre-line">{lesson.description}</p>
          </section>
        )}

        <section
          className={`relative rounded-2xl overflow-hidden p-6 md:p-8 bg-gradient-to-br ${course.coverColor} text-white`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={18} strokeWidth={2} />
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                Gostou do que viu?
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold">
              Continue estudando — matricule-se em {course.shortTitle}
            </h2>
            <p className="mt-2 text-sm opacity-90 max-w-xl">
              Acesse todas as aulas do curso, materiais complementares,
              certificado de conclusão e suporte do tutor.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to={`/curso-preview/${course.id}`}
                className="bg-white text-pco-deep px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 inline-flex items-center gap-1.5"
              >
                Ver detalhes do curso →
              </Link>
              <Link
                to="/login"
                className="bg-white/15 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/25 inline-flex items-center gap-1.5"
              >
                Já tenho cadastro
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
