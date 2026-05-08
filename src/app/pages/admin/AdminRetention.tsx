import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { TrendingUp, ArrowUpRight, Users, GraduationCap } from 'lucide-react';
import { useCourses } from '../../data/hooks';
import { useMemo } from 'react';
import { useT } from '../../i18n';

const cohortData = [
  { week: 'S1', psi: 100, tfs: 100, hipno: 100 },
  { week: 'S2', psi: 92, tfs: 88, hipno: 95 },
  { week: 'S4', psi: 80, tfs: 74, hipno: 86 },
  { week: 'S8', psi: 67, tfs: 61, hipno: 78 },
  { week: 'S12', psi: 58, tfs: 52, hipno: 69 },
  { week: 'S16', psi: 51, tfs: 44, hipno: 62 },
  { week: 'S20', psi: 47, tfs: 38, hipno: 56 },
];

// Conclusão por curso — gerada a partir dos cursos reais
function buildCompletionByCourse(courses: Array<{ shortTitle: string }> | undefined) {
  if (!courses) return [] as Array<{ name: string; conclusao: number; emRisco: number }>;
  return courses.map((c, i) => ({
    name: c.shortTitle,
    conclusao: [64, 52, 71][i] ?? 60,
    emRisco: [22, 28, 14][i] ?? 20,
  }));
}

const reengagementImpact = [
  { week: 'S1', enviados: 18, retomados: 4 },
  { week: 'S2', enviados: 22, retomados: 9 },
  { week: 'S3', enviados: 15, retomados: 7 },
  { week: 'S4', enviados: 27, retomados: 14 },
  { week: 'S5', enviados: 19, retomados: 11 },
];

export default function AdminRetention() {
  const t = useT();
  const { data: courses } = useCourses();
  const completionByCourse = useMemo(() => buildCompletionByCourse(courses), [courses]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('admin.nav.retention')}</h1>
        <p className="pco-section-subtitle mt-1">
          Indicadores e gráficos de retenção pedagógica.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Users size={16} />}
          label="Retenção 90d"
          value="64%"
          delta="+4pp"
          color="blue"
        />
        <Kpi
          icon={<TrendingUp size={16} />}
          label="Conclusão geral"
          value="58%"
          delta="+2pp"
          color="green"
        />
        <Kpi
          icon={<GraduationCap size={16} />}
          label="Ritmo médio (h/sem)"
          value="2,4"
          delta="+0.3"
          color="cyan"
        />
        <Kpi
          icon={<ArrowUpRight size={16} />}
          label="Impacto reengajamento"
          value="48%"
          delta="+9pp"
          color="orange"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-1">
            Curva de retenção por coorte
          </h3>
          <p className="text-xs text-ink-muted mb-3">% de alunos ativos por semana</p>
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cohortData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
                <XAxis dataKey="week" stroke="#98A2B3" fontSize={11} />
                <YAxis stroke="#98A2B3" fontSize={11} width={32} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #EEF5F7',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="psi"
                  name="Psicanálise"
                  stroke="#0097B2"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="tfs"
                  name="Familiar"
                  stroke="#0CC0DF"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="hipno"
                  name="Hipno"
                  stroke="#FE9002"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-1">
            Conclusão e risco por curso
          </h3>
          <p className="text-xs text-ink-muted mb-3">% atual</p>
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionByCourse}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
                <XAxis dataKey="name" stroke="#98A2B3" fontSize={11} />
                <YAxis stroke="#98A2B3" fontSize={11} width={32} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #EEF5F7',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="conclusao" name="Conclusão" fill="#0097B2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="emRisco" name="Em risco" fill="#FE9002" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-1">
          Impacto do reengajamento
        </h3>
        <p className="text-xs text-ink-muted mb-3">
          Comparação semanal entre planos enviados e alunos que retomaram estudos
        </p>
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reengagementImpact}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
              <XAxis dataKey="week" stroke="#98A2B3" fontSize={11} />
              <YAxis stroke="#98A2B3" fontSize={11} width={32} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #EEF5F7',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="enviados" name="Planos enviados" fill="#5CE1E6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="retomados" name="Retomaram" fill="#0097B2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  color: 'blue' | 'cyan' | 'green' | 'orange';
}) {
  const colorMap = {
    blue: { bg: 'bg-pco-blue/10', text: 'text-pco-blue' },
    cyan: { bg: 'bg-pco-cyan/15', text: 'text-pco-cyan' },
    green: { bg: 'bg-status-success/10', text: 'text-status-success' },
    orange: { bg: 'bg-pco-orange/10', text: 'text-pco-orange' },
  }[color];
  return (
    <div className="pco-card">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
          {label}
        </div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${colorMap.bg}`}>
          <span className={colorMap.text}>{icon}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-bold tracking-tight text-pco-deep">{value}</div>
        <span className="text-[11px] font-semibold text-status-success">{delta}</span>
      </div>
    </div>
  );
}
