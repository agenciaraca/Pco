import { useParams, Link } from 'react-router-dom';
import { ScrollText, Clock, Trophy, ArrowRight } from 'lucide-react';
import { useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { SemConexao, FalhaAoCarregar, NaoEncontrado } from '../components/EstadosDeConsulta';

export default function LMSAssessment() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>();
  const coursesQ = useCourses();
  const courses = coursesQ.data ?? [];
  if (coursesQ.fetchStatus === 'paused') return <SemConexao oQue="esta avaliação" />;
  if (coursesQ.isPending) return <CardListSkeleton count={2} />;
  if (coursesQ.isError)
    return (
      <FalhaAoCarregar
        erro={coursesQ.error}
        oQue="esta avaliação"
        aoTentarDeNovo={() => void coursesQ.refetch()}
      />
    );
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
  if (!course || !assessment || !module)
    return (
      <NaoEncontrado titulo="Não achei esta avaliação" acao={<>
            <Link to="/cursos" className="pco-btn-primary text-sm inline-flex">
              Ver meus cursos
            </Link>
            <Link to="/suporte" className="pco-btn-ghost text-sm inline-flex">
              Falar com a secretaria
            </Link>
          </>}>
        Pode ser um link antigo, ou a avaliação pode ter saído do módulo.
      </NaoEncontrado>
    );

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <Link
          to={`/curso/${course.id}/modulo/${module.id}`}
          className="text-xs font-medium text-pco-blue hover:underline"
        >
          ← Voltar ao módulo
        </Link>
        <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pco-orange">
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
          As questões são sorteadas do banco do módulo. Você pode refazer quantas vezes
          quiser — o que vale é entender, não acertar de primeira.
        </p>
        {/*
          O texto daqui dizia que a avaliação "ficará disponível assim que o
          sistema for plugado", e ainda assim mostrava um botão habilitado que
          não fazia nada — o aluno lia "pronto para começar?", clicava, e não
          acontecia nada.
          O sistema já existia: `/me/quiz/:courseId/start` aceita `moduleId`
          desde sempre. O que faltava era a tela do quiz repassar o parâmetro e
          este botão levar até lá.
        */}
        <Link
          to={`/curso/${course.id}/quiz?moduleId=${encodeURIComponent(module.id)}`}
          className="mt-6 pco-btn-primary inline-flex"
        >
          Iniciar avaliação
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
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
      <div className="text-xs uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-base font-semibold text-pco-deep">{value}</div>
    </div>
  );
}
