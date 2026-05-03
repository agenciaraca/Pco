import { Link } from 'react-router-dom';
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
import { courses, currentStudent, podcasts, newsArticles } from '../data/seed';

export default function Dashboard() {
  const enrolled = courses.filter((c) => currentStudent.enrolledCourseIds.includes(c.id));
  const weeklyProgress = Math.min(
    100,
    Math.round(((currentStudent.totalStudyMinutes % 240) / currentStudent.weeklyGoalMinutes) * 100),
  );

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-ink-muted">Bem-vindo de volta,</p>
          <h1 className="text-3xl font-bold tracking-tight text-pco-deep">
            {currentStudent.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Você está construindo uma rotina sólida. Continue no seu ritmo.
          </p>
        </div>
        <Link to="/jornada" className="pco-btn-primary">
          Ver Minha Jornada
          <ArrowRight size={16} strokeWidth={2} />
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Flame size={18} className="text-pco-orange" strokeWidth={2} />}
          label="Sequência"
          value="7"
          unit="dias"
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
          value="38%"
          unit="dos cursos"
          accent="green"
        />
        <KpiCard
          icon={<Award size={18} className="text-status-gold" strokeWidth={2} />}
          label="Certificados"
          value="0"
          unit="emitidos · 2 em andamento"
          accent="gold"
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="pco-section-title">Continuar estudando</h2>
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
                  className={`relative h-32 rounded-xl bg-gradient-to-br ${course.coverColor} mb-4 overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.25),transparent_60%)]" />
                  <div className="absolute bottom-3 left-4 text-white">
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
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
                  <div className="flex justify-between text-[11px] text-ink-muted mb-1">
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
              Continuar aula
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <Link to="/jornada" className="pco-btn-secondary">
              Ver jornada
            </Link>
          </div>
        </div>

        <div className="pco-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-3">
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
                  <div className="text-[11px] text-ink-subtle">Tire dúvidas pedagógicas</div>
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
                  <div className="text-[11px] text-ink-subtle">Conteúdo em áudio</div>
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
                  <div className="text-[11px] text-ink-subtle">Materiais de leitura</div>
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
          {newsArticles.slice(0, 2).map((article) => (
            <article key={article.id} className="pco-card pco-card-hover">
              <div className={`h-24 rounded-xl bg-gradient-to-br ${article.coverColor} mb-3`} />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-pco-blue">
                {article.category}
              </div>
              <h3 className="mt-1 text-base font-semibold text-pco-deep line-clamp-2">
                {article.title}
              </h3>
              <p className="mt-1 text-xs text-ink-muted line-clamp-3">{article.excerpt}</p>
            </article>
          ))}
          {podcasts.slice(0, 1).map((pod) => (
            <article key={pod.id} className="pco-card pco-card-hover">
              <div className={`h-24 rounded-xl bg-gradient-to-br ${pod.coverColor} mb-3 grid place-items-center`}>
                <Mic2 size={28} className="text-white" strokeWidth={1.5} />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-pco-cyan">
                PCO POD
              </div>
              <h3 className="mt-1 text-base font-semibold text-pco-deep line-clamp-2">
                {pod.title}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">{pod.durationMinutes} min</p>
            </article>
          ))}
        </div>
      </section>
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
