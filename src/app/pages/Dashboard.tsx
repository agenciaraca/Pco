import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useT } from '../i18n';
import {
  ArrowRight,
  Flame,
  Target,
  TrendingUp,
  PlayCircle,
  Sparkles,
  Bot,
  Mic2,
  BookOpen,
  Award,
  ChevronRight,
} from 'lucide-react';
import {
  useCourses,
  useCurrentStudent,
  useNews,
  usePodcasts,
  useMyProgress,
  useCertificates,
  useMyStreak,
  useLastLesson,
  useMyStudyHeatmap,
} from '../data/hooks';
import { Skeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/EmptyState';
import LeaderboardWidget from '../components/LeaderboardWidget';
import SuggestedCourses from '../components/SuggestedCourses';
import StudyHeatmap from '../components/StudyHeatmap';

export default function Dashboard() {
  const { user } = useAuth();
  const t = useT();
  const studentQ = useCurrentStudent();
  const coursesQ = useCourses();
  const newsQ = useNews();
  const podcastsQ = usePodcasts();
  const progressQ = useMyProgress();
  const streakQ = useMyStreak();
  const heatmapQ = useMyStudyHeatmap();
  const certsQ = useCertificates();
  const lastLessonQ = useLastLesson();
  useDocumentMeta({ title: `${t('nav.dashboard')} — AVA PCO` });

  // Admin/superadmin não tem dashboard de aluno — redireciona pro admin.
  // Após todos os hooks pra não violar rules-of-hooks.
  if (user && (user.role === 'admin' || user.role === 'superadmin')) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const isLoading = studentQ.isLoading || coursesQ.isLoading;
  const isError = studentQ.isError || coursesQ.isError;

  if (isError) {
    return (
      <div className="pco-card">
        <ErrorState
          title="Não conseguimos carregar seu painel"
          description="Verifique sua conexão e tente novamente."
          action={
            <button onClick={() => location.reload()} className="pco-btn-primary text-xs">
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  if (isLoading || !studentQ.data || !coursesQ.data) {
    return <DashboardSkeleton />;
  }

  const student = studentQ.data;
  const enrolledIds = (student as { enrolledCourseIds?: string[] }).enrolledCourseIds ?? [];
  const enrolled = coursesQ.data.filter((c) => enrolledIds.includes(c.id));
  const totalMinutes = (student as { totalStudyMinutes?: number }).totalStudyMinutes ?? 0;
  // Meta semanal vem do progressQ (atualizada em tempo real); fallback no student record
  const weeklyGoal =
    progressQ.data?.weeklyGoalMinutes ??
    (student as { weeklyGoalMinutes?: number }).weeklyGoalMinutes ??
    180;
  const weekMinutes = progressQ.data?.weekMinutes ?? 0;
  const weeklyProgress = Math.min(
    100,
    weeklyGoal > 0 ? Math.round((weekMinutes / weeklyGoal) * 100) : 0,
  );
  const completedLessons = progressQ.data?.completedLessonIds.length ?? 0;
  const totalEnrolledLessons = enrolled.reduce(
    (s, c) => s + c.modules.reduce((mm, m) => mm + (m.lessons?.length ?? 0), 0),
    0,
  );
  const overallPct =
    totalEnrolledLessons > 0
      ? Math.round((completedLessons / totalEnrolledLessons) * 100)
      : 0;
  const issuedCerts = (certsQ.data ?? []).filter((c) => c.status === 'issued').length;
  const inProgressCerts = (certsQ.data ?? []).filter((c) => c.status !== 'issued').length;

  // Próxima aula sugerida: primeira aula não-concluída do primeiro curso enrollado
  const doneIds = new Set(progressQ.data?.completedLessonIds ?? []);
  let nextLesson: {
    courseId: string;
    moduleId: string;
    lessonId: string;
    courseTitle: string;
    moduleTitle: string;
    lessonTitle: string;
  } | null = null;
  outer: for (const c of enrolled) {
    for (const m of c.modules) {
      for (const l of m.lessons) {
        if (!doneIds.has(l.id) && l.status !== 'completed') {
          nextLesson = {
            courseId: c.id,
            moduleId: m.id,
            lessonId: l.id,
            courseTitle: c.shortTitle,
            moduleTitle: m.title,
            lessonTitle: l.title,
          };
          break outer;
        }
      }
    }
  }

  /**
   * Ninguém concluiu aula alguma ainda. Vale distinguir porque a plataforma
   * recebeu centenas de alunos vindos da migração: dizer "você está construindo
   * uma rotina sólida" para quem acabou de entrar e tem 0% soa automático, e é a
   * primeira impressão que essa pessoa tem do ambiente novo.
   */
  const aindaNaoComecou = completedLessons === 0;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-ink-muted">
            {aindaNaoComecou ? 'Que bom ter você aqui,' : t('dashboard.welcome')}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-pco-deep">
            {student.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {aindaNaoComecou
              ? 'Seus cursos estão logo abaixo. Comece pela primeira aula quando quiser.'
              : t('dashboard.subtitle')}
          </p>
        </div>
        <Link to="/jornada" className="pco-btn-primary">
          {t('dashboard.viewJourney')}
          <ArrowRight size={16} strokeWidth={2} />
        </Link>
      </header>

      {lastLessonQ.data && (
        <Link
          to={`/curso/${lastLessonQ.data.courseId}/aula/${lastLessonQ.data.lessonId}`}
          className="pco-card pco-card-hover p-4 flex items-center gap-4 bg-gradient-to-r from-pco-blue/5 to-transparent block"
        >
          <div className="h-12 w-12 rounded-xl bg-pco-blue/10 grid place-items-center text-pco-blue shrink-0">
            <PlayCircle size={22} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-ink-subtle">
              {t('dashboard.continueFromHere')}
            </div>
            <div className="text-base font-bold text-pco-deep truncate">
              {lastLessonQ.data.lessonTitle}
            </div>
            <div className="text-xs text-ink-muted truncate">
              {lastLessonQ.data.courseTitle} · {lastLessonQ.data.moduleTitle}
            </div>
          </div>
          <ArrowRight size={16} className="text-pco-blue shrink-0" strokeWidth={2} />
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {streakQ.data && streakQ.data.current > 0 && (
          <div className="pco-card p-4 flex items-center gap-4 bg-gradient-to-r from-pco-orange/10 to-transparent">
            <div className="text-3xl">🔥</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-ink-subtle">
                Sequência atual
              </div>
              <div className="text-lg font-bold text-pco-deep">
                {streakQ.data.current} dia{streakQ.data.current !== 1 ? 's' : ''} estudando
                seguidos
              </div>
              <div className="text-xs text-ink-muted">
                Recorde: {streakQ.data.longest} dia
                {streakQ.data.longest !== 1 ? 's' : ''}
                {streakQ.data.lastActiveDay && (
                  <>
                    {' '}· última atividade:{' '}
                    {new Date(streakQ.data.lastActiveDay).toLocaleDateString('pt-BR')}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <LeaderboardWidget />
      </div>

      <SuggestedCourses />

      {heatmapQ.data && heatmapQ.data.summary.lastYearLessons > 0 && (
        <section className="pco-card p-5 space-y-3">
          <header className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-pco-deep">
              Sua trajetória
            </h3>
            <Link
              to="/perfil"
              className="text-xs text-pco-blue hover:underline"
            >
              Ver detalhes →
            </Link>
          </header>
          <StudyHeatmap
            days={heatmapQ.data.days}
            summary={heatmapQ.data.summary}
          />
        </section>
      )}

{nextLesson && (
        <Link
          to={`/curso/${nextLesson.courseId}/aula/${nextLesson.lessonId}`}
          className="pco-card p-6 flex items-center gap-4 hover:shadow-lift transition-shadow group bg-gradient-to-br from-pco-blue/5 to-pco-cyan/5"
        >
          <div className="h-12 w-12 rounded-xl bg-pco-blue/10 grid place-items-center group-hover:bg-pco-blue/15 transition-colors shrink-0">
            <PlayCircle size={22} className="text-pco-blue" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-ink-subtle">
              {aindaNaoComecou ? 'Comece por aqui' : 'Continue de onde parou'}
            </div>
            <div className="mt-1 text-base font-semibold text-pco-deep truncate">
              {nextLesson.lessonTitle}
            </div>
            <div className="text-xs text-ink-muted truncate">
              {nextLesson.courseTitle} · {nextLesson.moduleTitle}
            </div>
          </div>
          <ArrowRight
            size={18}
            strokeWidth={2}
            className="text-pco-blue group-hover:translate-x-1 transition-transform shrink-0"
          />
        </Link>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Flame size={18} className="text-pco-orange" strokeWidth={2} />}
          label="Sequência"
          value={String(progressQ.data?.streakDays ?? 0)}
          unit="dia(s) consecutivos"
          accent="orange"
        />
        <KpiCard
          icon={<Target size={18} className="text-pco-blue" strokeWidth={2} />}
          label="Meta semanal"
          value={`${weeklyProgress}%`}
          unit="atingida"
          accent="blue"
          progress={weeklyProgress}
        />
        <KpiCard
          icon={<TrendingUp size={18} className="text-status-success" strokeWidth={2} />}
          label="Progresso geral"
          value={`${overallPct}%`}
          unit={`${completedLessons}/${totalEnrolledLessons} aulas`}
          accent="green"
          progress={overallPct}
        />
        <KpiCard
          icon={<Award size={18} className="text-status-gold" strokeWidth={2} />}
          label="Certificados"
          value={String(issuedCerts)}
          unit={`emitidos${inProgressCerts > 0 ? ` · ${inProgressCerts} em andamento` : ''}`}
          accent="gold"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="pco-section-title">{t('dashboard.continueStudying')}</h2>
            <p className="pco-section-subtitle">Retome de onde parou em cada curso.</p>
          </div>
          <Link
            to="/cursos"
            className="text-sm font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            Ver todos
            <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {enrolled.map((course) => {
            const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
            const done = course.modules.reduce(
              (s, m) => s + m.lessons.filter((l) => l.status === 'completed').length,
              0,
            );
            const pct = Math.round((done / totalLessons) * 100);
            return (
              <Link key={course.id} to={`/curso/${course.id}`} className="pco-card pco-card-hover group">
                <div
                  className={`relative h-32 rounded-xl mb-4 overflow-hidden ${course.coverImageUrl ? 'bg-pco-deep' : `bg-gradient-to-br ${course.coverColor}`}`}
                >
                  {course.coverImageUrl && (
                    <img
                      src={course.coverImageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.25),transparent_60%)]" />
                  <div className="absolute bottom-3 left-4 text-white">
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                      Curso
                    </div>
                    <div className="text-base font-bold">{course.shortTitle}</div>
                  </div>
                  <PlayCircle
                    className="absolute bottom-3 right-3 text-white/90 group-hover:scale-110 transition-transform"
                    size={28}
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="text-base font-semibold text-pco-deep">{course.title}</h3>
                <p className="text-xs text-ink-muted mt-1 line-clamp-2">{course.description}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-ink-muted mb-1">
                    <span>Progresso</span>
                    <span className="font-semibold text-pco-deep">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-500 ease-smooth"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 pco-card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-pco-blue">
                <Sparkles size={14} strokeWidth={2} />
                Próxima melhor ação
              </div>
              <h3 className="mt-2 text-xl font-semibold text-pco-deep">
                Termine a aula 3 do Módulo 2 de Psicanálise
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                Você está a 22 minutos de concluir e desbloquear o próximo módulo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/curso/c-psi" className="pco-btn-primary">
              {t('dashboard.continueLesson')}
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <Link to="/jornada" className="pco-btn-secondary">
              Ver jornada
            </Link>
          </div>
        </div>

        <div className="pco-card">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3">
            Apoio rápido
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/tutor" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-gray">
                <div className="h-8 w-8 rounded-lg bg-pco-blue/10 grid place-items-center">
                  <Bot size={16} className="text-pco-blue" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-pco-deep">Tutor Virtual</div>
                  <div className="text-xs text-ink-subtle">Tire dúvidas pedagógicas</div>
                </div>
              </Link>
            </li>
            <li>
              <Link to="/podcasts" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-gray">
                <div className="h-8 w-8 rounded-lg bg-pco-cyan/15 grid place-items-center">
                  <Mic2 size={16} className="text-pco-cyan" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-pco-deep">PCO POD</div>
                  <div className="text-xs text-ink-subtle">Conteúdo em áudio</div>
                </div>
              </Link>
            </li>
            <li>
              <Link to="/biblioteca" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-gray">
                <div className="h-8 w-8 rounded-lg bg-pco-deep/10 grid place-items-center">
                  <BookOpen size={16} className="text-pco-deep" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-pco-deep">Biblioteca PCO</div>
                  <div className="text-xs text-ink-subtle">Materiais de leitura</div>
                </div>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="pco-section-title">Recomendado para sua jornada</h2>
          <Link
            to="/news"
            className="text-sm font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            Ver tudo
            <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {(newsQ.data ?? []).slice(0, 2).map((article) => (
            <article key={article.id} className="pco-card pco-card-hover">
              <div className={`h-24 rounded-xl bg-gradient-to-br ${article.coverColor} mb-3`} />
              <div className="text-xs font-semibold uppercase tracking-wider text-pco-blue">
                {article.category}
              </div>
              <h3 className="mt-1 text-base font-semibold text-pco-deep line-clamp-2">
                {article.title}
              </h3>
              <p className="mt-1 text-xs text-ink-muted line-clamp-3">{article.excerpt}</p>
            </article>
          ))}
          {(podcastsQ.data ?? []).slice(0, 1).map((pod) => (
            <Link key={pod.id} to={`/podcasts/${pod.id}`} className="pco-card pco-card-hover">
              <div className={`h-24 rounded-xl bg-gradient-to-br ${pod.coverColor} mb-3 grid place-items-center`}>
                <Mic2 size={28} className="text-white" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-pco-cyan">
                PCO POD
              </div>
              <h3 className="mt-1 text-base font-semibold text-pco-deep line-clamp-2">
                {pod.title}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">{pod.durationMinutes} min</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton variant="text" className="w-32 h-3 mb-2" />
        <Skeleton variant="text" className="w-48 h-7 mb-2" />
        <Skeleton variant="text" className="w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-28" />
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-72" />
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  unit,
  accent,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  accent: 'blue' | 'orange' | 'green' | 'gold';
  progress?: number;
}) {
  const accentBg = {
    blue: 'bg-pco-blue/10',
    orange: 'bg-pco-orange/10',
    green: 'bg-status-success/10',
    gold: 'bg-status-gold/10',
  }[accent];
  const barColor = {
    blue: 'bg-pco-blue',
    orange: 'bg-pco-orange',
    green: 'bg-status-success',
    gold: 'bg-status-gold',
  }[accent];

  return (
    <div className="pco-card">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-subtle">{label}</div>
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${accentBg}`}>{icon}</div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-pco-deep">{value}</div>
        <div className="text-xs text-ink-muted">{unit}</div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 rounded-full bg-surface-gray overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-smooth ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
