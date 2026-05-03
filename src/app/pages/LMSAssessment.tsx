import { useParams, Navigate, Link } from 'react-router-dom';
import { ScrollText, Clock, Trophy, ArrowRight } from 'lucide-react';
import { courses } from '../data/seed';

export default function LMSAssessment() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>();
  const course = courses.find((c) => c.id === courseId);
  let assessment;
  let module;
  if (course) {
    for (const m of course.modules) {
      if (m.assessment?.id === assessmentId) {
        assessment = m.assessment;
        module = m;
        break;
      }
    }
  }
  if (!course || !assessment || !module) return <Navigate to="/cursos" replace />;

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <Link
          to={`/curso/${course.id}/modulo/${module.id}`}
          className="text-xs font-medium text-pco-blue hover:underline"
        >
          ← Voltar ao módulo
        </Link>
        <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-pco-orange">
          <ScrollText size={12} strokeWidth={2} />
          Avaliação do módulo
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pco-deep">{assessment.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Esta avaliação testa seu entendimento dos conceitos do módulo {module.order}.
        </p>
      </header>

      <div className="pco-card grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat icon={<ScrollText size={16} />} label="Questões" value={`${assessment.questionCount}`} />
        <Stat icon={<Trophy size={16} />} label="Aprovação" value={`${assessment.passingScore}%`} />
        <Stat
          icon={<Clock size={16} />}
          label="Tempo limite"
          value={assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : 'Sem limite'}
        />
      </div>

      <div className="pco-card text-center py-10 px-6">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-pco-orange/10 grid place-items-center mb-4">
          <ScrollText className="text-pco-orange" size={26} strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-pco-deep">Pronto para começar?</h2>
        <p className="mt-2 text-sm text-ink-muted max-w-md mx-auto">
          A avaliação ficará disponível assim que o sistema de avaliações for plugado. Por
          enquanto, este é o layout final preparado para integração.
        </p>
        <button className="mt-6 pco-btn-primary">
          Iniciar avaliação
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-surface-off p-4">
      <div className="text-pco-blue mb-1">{icon}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-base font-semibold text-pco-deep">{value}</div>
    </div>
  );
}
