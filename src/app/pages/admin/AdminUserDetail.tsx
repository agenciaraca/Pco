import { useParams, Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Lock,
  Unlock,
  Sparkles,
  User,
  TrendingUp,
  AlertTriangle,
  Award,
  Bot,
  Mic2,
  BookOpen,
  Send,
  CheckCircle2,
  PlayCircle,
  Calendar,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import {
  useAdminStudents,
  useCourses,
  useRetentionRisks,
  useAllCertificates,
  useUserTimeline,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';

const statusStyles: Record<string, string> = {
  ativo: 'bg-status-success/10 text-status-success',
  em_risco: 'bg-pco-orange/10 text-pco-orange',
  bloqueado: 'bg-status-danger/15 text-status-danger',
  inativo: 'bg-surface-gray text-ink-muted',
};
const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  em_risco: 'Em risco',
  bloqueado: 'Bloqueado',
  inativo: 'Inativo',
};

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const [active, setActive] = useState('geral');
  const studentsQ = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const coursesQ = useCourses();
  const risksQ = useRetentionRisks();
  const certsQ = useAllCertificates();
  const timelineQ = useUserTimeline(id);

  if (studentsQ.isLoading || coursesQ.isLoading) {
    return <CardListSkeleton count={4} />;
  }

  const student = (studentsQ.data ?? []).find((s) => s.id === id);
  if (!student) return <Navigate to="/admin/alunos" replace />;

  const courses = coursesQ.data ?? [];
  const retentionRisks = risksQ.data ?? [];
  const certificates = (certsQ.data ?? []).filter((c) => c.studentId === student.id);

  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  const enrolled = student.enrolledCourseIds
    .map((cid: string) => courses.find((c) => c.id === cid))
    .filter(Boolean) as (typeof courses)[number][];
  const risk = retentionRisks.find((r) => r.studentId === student.id);

  const tabs = [
    { id: 'geral', label: 'Geral', icon: <User size={14} strokeWidth={1.75} /> },
    {
      id: 'progresso',
      label: 'Progresso',
      icon: <TrendingUp size={14} strokeWidth={1.75} />,
      badge: enrolled.length,
    },
    { id: 'risco', label: 'Risco', icon: <AlertTriangle size={14} strokeWidth={1.75} /> },
    { id: 'certificados', label: 'Certificados', icon: <Award size={14} strokeWidth={1.75} /> },
    { id: 'recursos', label: 'Tutor / POD / Biblioteca', icon: <Bot size={14} strokeWidth={1.75} /> },
    { id: 'historico', label: 'Histórico', icon: <Send size={14} strokeWidth={1.75} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/alunos"
          className="text-xs font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar aos alunos
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xl font-bold text-white shadow-soft">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-pco-deep">{student.name}</h1>
            <p className="text-sm text-ink-muted">{student.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className={`pco-badge ${statusStyles[student.status]}`}>
                {statusLabel[student.status]}
              </span>
              <span className="text-ink-subtle">
                Aluno desde {new Date(student.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="pco-btn-secondary text-xs">
            <Mail size={12} strokeWidth={2} />
            Enviar e-mail
          </button>
          <button className="pco-btn-secondary text-xs">
            {student.status === 'bloqueado' ? (
              <>
                <Unlock size={12} strokeWidth={2} />
                Desbloquear
              </>
            ) : (
              <>
                <Lock size={12} strokeWidth={2} />
                Bloquear
              </>
            )}
          </button>
          <Link to="/admin/plano-retomada-ia" className="pco-btn-primary text-xs">
            <Sparkles size={12} strokeWidth={2} />
            Plano de Retomada IA
          </Link>
        </div>
      </header>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'geral' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 pco-card space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Dados acadêmicos</h3>
            <Row label="ID interno" value={student.id} mono />
            <Row label="E-mail" value={student.email} />
            <Row label="Status" value={statusLabel[student.status]} />
            <Row label="Score de risco" value={`${student.riskScore}/100`} />
            <Row
              label="Último acesso"
              value={new Date(student.lastAccessAt).toLocaleString('pt-BR')}
            />
            <Row
              label="Cadastro"
              value={new Date(student.createdAt).toLocaleDateString('pt-BR')}
            />
          </div>
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3">Cursos</h3>
            <ul className="space-y-2">
              {enrolled.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-off"
                >
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${c.coverColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep truncate">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-ink-subtle">
                      {student.progressByCourse[c.id] ?? 0}% concluído
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {active === 'progresso' && (
        <div className="space-y-4">
          {enrolled.map((c) => {
            const pct = student.progressByCourse[c.id] ?? 0;
            return (
              <div key={c.id} className="pco-card">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${c.coverColor}`} />
                    <div>
                      <div className="text-sm font-semibold text-pco-deep">{c.title}</div>
                      <div className="text-[11px] text-ink-subtle">
                        {c.modules.length} módulos
                      </div>
                    </div>
                  </div>
                  <span className="pco-badge bg-pco-blue/10 text-pco-blue">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-gray overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Box label="Aulas concluídas" value={`${Math.round((pct / 100) * 24)}/24`} />
                  <Box label="Avaliações" value="2/8" />
                  <Box label="Tutor (uso)" value="12" />
                  <Box label="POD (plays)" value="6" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {active === 'risco' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 pco-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-pco-deep">Score de evasão</h3>
              <span
                className={`pco-badge ${
                  student.riskScore >= 75
                    ? 'bg-status-danger/15 text-status-danger'
                    : student.riskScore >= 55
                      ? 'bg-pco-orange/15 text-pco-orange'
                      : 'bg-pco-blue/10 text-pco-blue'
                }`}
              >
                {student.riskScore}/100
              </span>
            </div>
            <div className="h-3 rounded-full bg-surface-gray overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  student.riskScore >= 75
                    ? 'bg-status-danger'
                    : student.riskScore >= 55
                      ? 'bg-pco-orange'
                      : student.riskScore >= 30
                        ? 'bg-pco-blue'
                        : 'bg-status-success'
                }`}
                style={{ width: `${student.riskScore}%` }}
              />
            </div>
            {risk && (
              <div className="mt-5 space-y-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-subtle mb-1.5">
                    Motivos
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {risk.reasons.map((r) => (
                      <span key={r} className="pco-badge bg-surface-gray text-ink-muted">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <Row label="Progresso esperado" value={`${risk.expectedProgress}%`} />
                <Row label="Progresso real" value={`${risk.realProgress}%`} />
                <Row label="Avaliações pendentes" value={risk.pendingAssessments} />
                <Row label="Uso do Tutor" value={risk.tutorUsage} />
                <Row label="Consumo POD" value={risk.podConsumption} />
              </div>
            )}
          </div>
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-2">Ação recomendada</h3>
            <p className="text-sm text-ink-muted mb-4">
              {risk?.recommendedAction ?? 'Nenhuma ação urgente.'}
            </p>
            <Link to="/admin/plano-retomada-ia" className="pco-btn-primary w-full justify-center text-xs">
              <Sparkles size={12} strokeWidth={2} />
              Gerar Plano de Retomada
            </Link>
          </div>
        </div>
      )}

      {active === 'certificados' && (
        <div className="grid gap-4 md:grid-cols-2">
          {certificates.map((cert) => {
            const c = courses.find((co) => co.id === cert.courseId);
            if (!c) return null;
            return (
              <div key={cert.id} className="pco-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-status-gold/15 grid place-items-center">
                    <Award size={18} className="text-status-gold" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-pco-deep">{c.title}</div>
                    <div className="text-[11px] text-ink-subtle font-mono">
                      {cert.validationCode}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-[11px] text-ink-muted mb-1">{cert.progress}% concluído</div>
                  <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-status-gold to-pco-orange"
                      style={{ width: `${cert.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {active === 'recursos' && (
        <div className="grid gap-4 md:grid-cols-3">
          <ResourceCard
            icon={<Bot size={18} className="text-pco-blue" strokeWidth={1.75} />}
            title="Tutor Virtual"
            value="12 perguntas"
            sub="Última: há 3 dias"
          />
          <ResourceCard
            icon={<Mic2 size={18} className="text-pco-cyan" strokeWidth={1.75} />}
            title="PCO POD"
            value="6 plays"
            sub="2 episódios concluídos"
          />
          <ResourceCard
            icon={<BookOpen size={18} className="text-pco-deep" strokeWidth={1.75} />}
            title="Biblioteca"
            value="3 downloads"
            sub="1 favorito"
          />
        </div>
      )}

      {active === 'historico' && (
        <div className="pco-card p-0 overflow-hidden">
          {timelineQ.isLoading ? (
            <div className="p-6 text-sm text-ink-muted">Carregando timeline...</div>
          ) : !timelineQ.data || timelineQ.data.length === 0 ? (
            <div className="p-6 text-sm text-ink-muted text-center">
              Sem atividade registrada ainda.
            </div>
          ) : (
            <ul className="divide-y divide-surface-gray">
              {timelineQ.data.map((ev, i) => {
                const Icon =
                  ev.type === 'progress'
                    ? PlayCircle
                    : ev.type === 'cert'
                      ? Award
                      : ev.type === 'ticket'
                        ? Send
                        : ev.type === 'tutor'
                          ? Bot
                          : Calendar;
                const color =
                  ev.type === 'progress'
                    ? 'text-pco-blue'
                    : ev.type === 'cert'
                      ? 'text-status-gold'
                      : ev.type === 'ticket'
                        ? 'text-pco-orange'
                        : ev.type === 'tutor'
                          ? 'text-pco-cyan'
                          : 'text-ink-muted';
                return (
                  <Event
                    key={`${ev.ts}-${i}`}
                    icon={<Icon size={14} className={color} strokeWidth={1.75} />}
                    title={ev.title}
                    date={ev.ts}
                    text={ev.body}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-semibold text-pco-deep ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-off p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-sm font-semibold text-pco-deep">{value}</div>
    </div>
  );
}

function ResourceCard({
  icon,
  title,
  value,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="pco-card">
      <div className="h-10 w-10 rounded-xl bg-surface-off grid place-items-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-semibold text-pco-deep">{title}</div>
      <div className="mt-2 text-xl font-bold text-pco-deep">{value}</div>
      <div className="text-[11px] text-ink-subtle">{sub}</div>
    </div>
  );
}

function Event({
  icon,
  title,
  date,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  date: string;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3 p-4 hover:bg-surface-off">
      <div className="h-8 w-8 rounded-lg bg-surface-off grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-pco-deep">{title}</div>
          <div className="text-[11px] text-ink-subtle">
            {new Date(date).toLocaleDateString('pt-BR')}
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-0.5">{text}</p>
      </div>
    </li>
  );
}
