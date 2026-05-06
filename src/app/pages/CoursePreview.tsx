import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Layers,
  PlayCircle,
  Lock,
  BookOpen,
  Star,
} from 'lucide-react';
import {
  useCourse,
  useCoursePrereqCheck,
  useProducts,
  useCourseRating,
} from '../data/hooks';
import { useAuth } from '../auth/AuthContext';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import Logo from '../components/Logo';

export default function CoursePreview() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: course, isLoading } = useCourse(id);
  const { data: products = [] } = useProducts();
  const rating = useCourseRating(id);
  const prereqQ = useCoursePrereqCheck(user ? id : undefined);
  useDocumentMeta({
    title: course ? `${course.title} — AVA PCO` : 'Curso — AVA PCO',
    description: course?.description,
  });

  if (isLoading) return <CardListSkeleton count={3} />;
  if (!course) {
    return (
      <div className="p-10">
        <EmptyState
          title="Curso não encontrado"
          description="Verifique o link ou veja o catálogo completo."
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

  const product = products.find(
    (p) => p.kind === 'course' && p.refId === course.id && p.active,
  );
  const price =
    product &&
    (product.priceCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: product.currency,
    });
  const totalLessons = course.modules.reduce(
    (s, m) => s + m.lessons.length,
    0,
  );

  return (
    <div className="min-h-screen bg-surface-off">
      <header className="bg-white border-b border-pco-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/catalogo" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/catalogo" className="pco-btn-ghost text-xs hidden sm:inline-flex">
              <ArrowLeft size={11} strokeWidth={2} />
              Catálogo
            </Link>
            <Link to="/login" className="pco-btn-ghost text-sm">
              Entrar
            </Link>
            <Link to="/login" className="pco-btn-primary text-sm">
              Começar
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {!user && (course.prerequisiteCourseIds?.length ?? 0) > 0 && (
          <section
            role="note"
            className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex items-start gap-3"
          >
            <Lock size={18} className="text-pco-blue mt-0.5" strokeWidth={2} />
            <div className="text-sm">
              <strong className="text-pco-deep">Curso com pré-requisito.</strong>{' '}
              <span className="text-ink-muted">
                Este curso exige a conclusão de {course.prerequisiteCourseIds!.length}{' '}
                outro{course.prerequisiteCourseIds!.length === 1 ? '' : 's'} antes da
                matrícula. Faça login pra ver o status detalhado.
              </span>
            </div>
          </section>
        )}

        {user && prereqQ.data && !prereqQ.data.ok && (
          <section
            role="alert"
            className="pco-card border-pco-orange/40 bg-pco-orange/5 p-5 space-y-3"
          >
            <header className="flex items-center gap-2">
              <Lock size={18} className="text-pco-orange" strokeWidth={2} />
              <h2 className="text-base font-semibold text-pco-deep">
                Pré-requisitos pendentes
              </h2>
            </header>
            <p className="text-sm text-ink-strong">
              Para acessar este curso você precisa concluir antes:
            </p>
            <ul className="space-y-1.5">
              {prereqQ.data.status.map((s) => (
                <li
                  key={s.courseId}
                  className="flex items-center gap-2 text-sm"
                >
                  {s.completed ? (
                    <span className="text-status-success">✓</span>
                  ) : (
                    <span className="text-pco-orange">○</span>
                  )}
                  <span className={s.completed ? 'text-ink-muted line-through' : 'text-ink-strong'}>
                    {s.title ?? s.courseId}
                  </span>
                  {!s.completed && s.slug && (
                    <Link
                      to={`/curso-preview/${s.courseId}`}
                      className="text-[11px] text-pco-blue hover:underline ml-auto"
                    >
                      ver curso →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-subtle">
              Você ainda pode visualizar o conteúdo do curso aqui, mas a
              matrícula efetiva exige completar os pré-requisitos.
            </p>
          </section>
        )}

        <section
          className={`relative rounded-2xl overflow-hidden p-8 md:p-12 bg-gradient-to-br ${course.coverColor}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative text-white max-w-2xl">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-semibold uppercase tracking-wider">
              {course.shortTitle}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mt-3 leading-tight">
              {course.title}
            </h1>
            <p className="mt-3 text-base opacity-90 max-w-xl">
              {course.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Layers size={14} strokeWidth={1.75} />
                {course.modules.length} módulos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={14} strokeWidth={1.75} />
                {totalLessons} aulas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} strokeWidth={1.75} />
                {course.totalHours}h
              </span>
              {rating.data && rating.data.count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Star size={14} className="fill-current" strokeWidth={0} />
                  {rating.data.avg.toFixed(1)} ({rating.data.count})
                </span>
              )}
            </div>
          </div>
        </section>

        {course.instructorName && (
          <section className="pco-card p-6">
            <h2 className="text-lg font-bold text-pco-deep mb-4">
              Sobre o instrutor
            </h2>
            <div className="flex items-start gap-4 flex-wrap">
              {course.instructorPhotoUrl ? (
                <img
                  src={course.instructorPhotoUrl}
                  alt={course.instructorName}
                  className="h-20 w-20 rounded-full object-cover bg-surface-mute shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pco-blue/20 to-pco-cyan/20 grid place-items-center text-pco-deep font-bold text-xl shrink-0">
                  {course.instructorName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-[240px]">
                <h3 className="text-base font-semibold text-pco-deep">
                  {course.instructorName}
                </h3>
                {course.instructorBio && (
                  <p className="text-sm text-ink-muted mt-1 whitespace-pre-line">
                    {course.instructorBio}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {(course.collaborators?.length ?? 0) > 0 && (
          <section className="pco-card p-6">
            <h2 className="text-lg font-bold text-pco-deep mb-4">
              Equipe pedagógica
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {course.collaborators!.map((c, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt={c.name}
                      className="h-12 w-12 rounded-full object-cover bg-surface-mute shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pco-blue/15 to-pco-cyan/15 grid place-items-center text-pco-deep font-bold text-xs shrink-0">
                      {c.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep">
                      {c.name}
                    </div>
                    {c.role && (
                      <div className="text-[11px] text-pco-blue uppercase tracking-wide font-medium">
                        {c.role}
                      </div>
                    )}
                    {c.bio && (
                      <p className="text-xs text-ink-muted mt-1 line-clamp-3">
                        {c.bio}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(course.learningOutcomes?.length ?? 0) > 0 && (
          <section className="pco-card p-6">
            <h2 className="text-lg font-bold text-pco-deep mb-4">
              O que você vai aprender
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {course.learningOutcomes!.map((o, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-ink-strong"
                >
                  <span className="text-pco-blue text-lg leading-tight">✓</span>
                  <span className="flex-1">{o}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <section className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-pco-deep">
              Conteúdo programático
            </h2>
            {course.modules.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Conteúdo em preparação.
              </p>
            ) : (
              <ol className="space-y-3">
                {course.modules.map((m, mi) => (
                  <li key={m.id} className="pco-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="h-7 w-7 rounded-full bg-pco-blue/10 text-pco-blue grid place-items-center text-sm font-bold shrink-0">
                        {mi + 1}
                      </span>
                      <div className="flex-1">
                        <div className="font-semibold text-pco-deep">
                          {m.title}
                        </div>
                        {m.description && (
                          <p className="text-xs text-ink-muted mt-1">
                            {m.description}
                          </p>
                        )}
                        <ul className="mt-3 space-y-1.5">
                          {m.lessons.map((l) => {
                            const inner = (
                              <>
                                {l.isPreview ? (
                                  <PlayCircle
                                    size={11}
                                    className="text-pco-blue shrink-0"
                                    strokeWidth={2}
                                  />
                                ) : (
                                  <Lock size={10} className="text-ink-subtle shrink-0" />
                                )}
                                <span className="flex-1 truncate">
                                  {l.title}
                                  {l.isPreview && (
                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-pco-blue/10 text-pco-blue text-[9px] font-bold uppercase tracking-wider">
                                      Preview livre
                                    </span>
                                  )}
                                </span>
                                {l.durationMinutes && (
                                  <span className="text-[10px] text-ink-subtle">
                                    {l.durationMinutes}min
                                  </span>
                                )}
                              </>
                            );
                            return l.isPreview ? (
                              <li key={l.id}>
                                <Link
                                  to={`/aula-preview/${l.id}`}
                                  className="flex items-center gap-2 text-xs text-pco-blue hover:underline"
                                >
                                  {inner}
                                </Link>
                              </li>
                            ) : (
                              <li
                                key={l.id}
                                className="flex items-center gap-2 text-xs text-ink-muted"
                              >
                                {inner}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside className="space-y-3 md:sticky md:top-6 self-start">
            <div className="pco-card p-5 space-y-4">
              {price ? (
                <>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-ink-subtle">
                      A partir de
                    </div>
                    <div className="text-3xl font-bold text-pco-deep">{price}</div>
                  </div>
                  <Link
                    to="/login"
                    className="pco-btn-primary w-full justify-center"
                  >
                    <PlayCircle size={14} strokeWidth={2} />
                    Quero estudar
                  </Link>
                  <p className="text-[11px] text-ink-subtle text-center">
                    Acesso liberado após confirmação do pagamento
                  </p>
                </>
              ) : (
                <Link
                  to="/login"
                  className="pco-btn-primary w-full justify-center"
                >
                  Saber mais
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              )}
            </div>
            <div className="pco-card p-4 text-xs text-ink-muted space-y-2">
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-ink-muted">
                O que você ganha
              </h3>
              <ul className="space-y-1.5">
                <li>✓ Acesso vitalício às aulas</li>
                <li>✓ Certificado de conclusão</li>
                <li>✓ Tutor virtual e suporte</li>
                <li>✓ Comunidade de alunos</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="bg-white border-t border-pco-border py-6 mt-10">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-ink-subtle">
          © {new Date().getFullYear()} Psicanálise Clínica Online — AVA PCO
        </div>
      </footer>
    </div>
  );
}
