import { useParams, Link, Navigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
  Eye,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import Tabs from '../../components/Tabs';
import AdminNotesPanel from '../../components/AdminNotesPanel';
import StudentAnalyticsPanel from '../../components/StudentAnalyticsPanel';
import { MessageSquare, BarChart3 } from 'lucide-react';
import {
  useAdminStudents,
  useCourses,
  useRetentionRisks,
  useAllCertificates,
  useIssueCertificate,
  useUserTimeline,
  useAdminStudentStats,
  useStudentCourseAccess,
  useExtendStudentCourseAccess,
} from '../../data/hooks';
import type { CourseAccessRow, ExtendAccessGrant } from '../../data/api';
import { useToast } from '../../components/Toast';
import { Plus, Loader2 } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') ?? 'geral';
  const [active, setActive] = useState(tabParam);
  useEffect(() => {
    if (tabParam !== active) setActive(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const handleTabChange = (next: string) => {
    setActive(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'geral') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const auth = useAuth();
  const studentsQ = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const coursesQ = useCourses();
  const risksQ = useRetentionRisks();
  const certsQ = useAllCertificates();
  const timelineQ = useUserTimeline(id);
  const statsQ = useAdminStudentStats(id);

  async function handleImpersonate() {
    if (!id || impersonating) return;
    setImpersonating(true);
    setImpersonateError(null);
    try {
      await auth.startImpersonation(id);
    } catch (err) {
      setImpersonating(false);
      setImpersonateError(
        err instanceof Error ? err.message : 'Falha ao iniciar visualização.',
      );
    }
  }

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
    { id: 'acesso', label: 'Acesso', icon: <Calendar size={14} strokeWidth={1.75} /> },
    { id: 'risco', label: 'Risco', icon: <AlertTriangle size={14} strokeWidth={1.75} /> },
    { id: 'certificados', label: 'Certificados', icon: <Award size={14} strokeWidth={1.75} /> },
    { id: 'recursos', label: 'Tutor / POD / Biblioteca', icon: <Bot size={14} strokeWidth={1.75} /> },
    { id: 'historico', label: 'Histórico', icon: <Send size={14} strokeWidth={1.75} /> },
    { id: 'notas', label: 'Notas', icon: <MessageSquare size={14} strokeWidth={1.75} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} strokeWidth={1.75} /> },
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
          <button
            type="button"
            onClick={handleImpersonate}
            disabled={impersonating || !auth.user || (auth.user.role !== 'admin' && auth.user.role !== 'superadmin')}
            className="pco-btn-secondary text-xs disabled:opacity-50"
            title="Visualizar a plataforma como este aluno (suporte)"
          >
            <Eye size={12} strokeWidth={2} />
            {impersonating ? 'Entrando…' : 'Entrar como aluno'}
          </button>
          <Link to="/admin/plano-retomada-ia" className="pco-btn-primary text-xs">
            <Sparkles size={12} strokeWidth={2} />
            Plano de Retomada IA
          </Link>
        </div>
      </header>

      {impersonateError && (
        <div className="pco-card border-status-danger/30 bg-status-danger/5 text-sm text-status-danger">
          {impersonateError}
        </div>
      )}

      <Tabs items={tabs} active={active} onChange={handleTabChange} />

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

      {active === 'acesso' && <AccessPane studentId={student.id} />}

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
        <CertificadosTab student={student} courses={courses} certificates={certificates} />
      )}

      {active === 'recursos' && (
        <div className="grid gap-4 md:grid-cols-3">
          <ResourceCard
            icon={<Bot size={18} className="text-pco-blue" strokeWidth={1.75} />}
            title="Tutor Virtual"
            value={
              statsQ.data
                ? `${statsQ.data.tutor.questionCount} pergunta${statsQ.data.tutor.questionCount === 1 ? '' : 's'}`
                : '—'
            }
            sub={
              statsQ.data?.tutor.lastAt
                ? `Última: ${new Date(statsQ.data.tutor.lastAt).toLocaleDateString('pt-BR')}`
                : 'Sem uso ainda'
            }
          />
          <ResourceCard
            icon={<Mic2 size={18} className="text-pco-cyan" strokeWidth={1.75} />}
            title="PCO POD"
            value={
              statsQ.data
                ? `${statsQ.data.podcast.plays} play${statsQ.data.podcast.plays === 1 ? '' : 's'}`
                : '—'
            }
            sub={
              statsQ.data
                ? `${statsQ.data.podcast.favorites} favorito${statsQ.data.podcast.favorites === 1 ? '' : 's'}`
                : 'Sem dados'
            }
          />
          <ResourceCard
            icon={<BookOpen size={18} className="text-pco-deep" strokeWidth={1.75} />}
            title="Biblioteca"
            value={statsQ.data?.library.downloads != null ? String(statsQ.data.library.downloads) : '—'}
            sub="Tracking de download por aluno em breve"
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

      {active === 'notas' && <AdminNotesPanel studentId={student.id} />}

      {active === 'analytics' && <StudentAnalyticsPanel studentId={student.id} />}
    </div>
  );
}

/**
 * Prazo de acesso por curso, e a renovação.
 *
 * A renovação é manual de propósito: a compra da extensão ainda não passa pelo
 * gateway, então hoje o caminho é o admin confirmar o pagamento e somar os meses
 * aqui. Quando o produto de extensão existir, ele chama o mesmo endpoint.
 */
function AccessPane({ studentId }: { studentId: string }) {
  const toast = useToast();
  const accessQ = useStudentCourseAccess(studentId);
  const extend = useExtendStudentCourseAccess(studentId);
  const [pending, setPending] = useState<string | null>(null);

  async function apply(row: CourseAccessRow, grant: ExtendAccessGrant, descricao: string) {
    setPending(row.courseId);
    try {
      const r = await extend.mutateAsync({ courseId: row.courseId, grant });
      toast.success(
        `Acesso atualizado — ${row.courseTitle}`,
        r.expiresAt
          ? `${descricao}. Agora vale até ${new Date(r.expiresAt).toLocaleDateString('pt-BR')}.`
          : `${descricao}. Este curso passou a valer sem prazo para o aluno.`,
      );
    } catch (err) {
      toast.error('Não foi possível atualizar', err instanceof Error ? err.message : 'Erro');
    } finally {
      setPending(null);
    }
  }

  if (accessQ.isLoading) return <CardListSkeleton count={2} />;

  const rows = accessQ.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="pco-card text-sm text-ink-muted">
        Este aluno não tem matrícula em nenhum curso.
      </div>
    );
  }

  const rotulo: Record<CourseAccessRow['state'], { texto: string; classe: string }> = {
    lifetime: { texto: 'Sem prazo', classe: 'bg-pco-blue/10 text-pco-blue' },
    active: { texto: 'No prazo', classe: 'bg-status-success/10 text-status-success' },
    expiring: { texto: 'Vence em breve', classe: 'bg-status-warning/10 text-status-warning' },
    expired: { texto: 'Vencido', classe: 'bg-status-danger/10 text-status-danger' },
  };

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const tag = rotulo[row.state];
        const ocupado = pending === row.courseId;
        return (
          <div key={row.courseId} className="pco-card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-pco-deep">{row.courseTitle}</div>
                <div className="text-[11px] text-ink-subtle mt-0.5">
                  {row.enrolledAt
                    ? `Matriculado em ${new Date(row.enrolledAt).toLocaleDateString('pt-BR')}`
                    : 'Data de matrícula desconhecida'}
                  {row.accessMonths
                    ? ` · curso dá ${row.accessMonths} ${row.accessMonths === 1 ? 'mês' : 'meses'}`
                    : ' · curso sem prazo definido'}
                </div>
              </div>
              <span className={`pco-badge ${tag.classe}`}>{tag.texto}</span>
            </div>

            <div className="mt-3 text-sm text-ink-muted">
              {row.expiresAt ? (
                <>
                  Acesso até{' '}
                  <strong className="text-pco-deep">
                    {new Date(row.expiresAt).toLocaleDateString('pt-BR')}
                  </strong>
                  {row.daysLeft !== null && (
                    <span className="text-ink-subtle">
                      {row.daysLeft >= 0
                        ? ` — faltam ${row.daysLeft} ${row.daysLeft === 1 ? 'dia' : 'dias'}`
                        : ` — venceu há ${Math.abs(row.daysLeft)} ${
                            Math.abs(row.daysLeft) === 1 ? 'dia' : 'dias'
                          }`}
                    </span>
                  )}
                </>
              ) : (
                'Acesso sem data de término.'
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-surface-gray">
              <span className="text-[11px] uppercase tracking-wide text-ink-subtle mr-1">
                Renovar
              </span>
              {[6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={ocupado}
                  onClick={() => apply(row, { months: m }, `Somados ${m} meses`)}
                  className="pco-btn-secondary text-xs"
                >
                  {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}+
                  {m} meses
                </button>
              ))}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => apply(row, { lifetime: true }, 'Prazo removido')}
                className="pco-btn-ghost text-xs"
              >
                Tirar o prazo
              </button>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-ink-subtle">
        Renovar soma ao prazo que ainda resta. Se já venceu, conta a partir de hoje — o aluno não
        recebe de volta os dias em que ficou sem acesso.
      </p>
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

function CertificadosTab({
  student,
  courses,
  certificates,
}: {
  student: { id: string; name: string; enrolledCourseIds: string[]; progressByCourse: Record<string, number> };
  courses: Array<{ id: string; title: string; certificateAvailable?: boolean }>;
  certificates: Array<{
    id: string;
    courseId: string;
    studentId: string;
    issuedAt?: string;
    validationCode: string;
    status: 'in_progress' | 'available' | 'issued';
    progress: number;
  }>;
}) {
  const toast = useToast();
  const issueMut = useIssueCertificate();
  const certifiedCourseIds = new Set(
    certificates.filter((c) => c.status === 'issued').map((c) => c.courseId),
  );
  const eligibleCourses = student.enrolledCourseIds
    .map((cid) => courses.find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> => !!c && !certifiedCourseIds.has(c.id));

  async function handleIssue(courseId: string, courseTitle: string) {
    if (!confirm(`Emitir certificado de "${courseTitle}" para ${student.name}?`))
      return;
    try {
      await issueMut.mutateAsync({ studentId: student.id, courseId });
      toast.success('Certificado emitido', courseTitle);
    } catch (err) {
      toast.error('Falha ao emitir', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-pco-deep mb-3">
          Emitidos · {certificates.length}
        </h3>
        {certificates.length === 0 ? (
          <div className="pco-card text-center py-6 text-sm text-ink-muted">
            Nenhum certificado emitido ainda.
          </div>
        ) : (
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
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-pco-deep truncate">
                        {c.title}
                      </div>
                      <div className="text-[11px] text-ink-subtle font-mono">
                        {cert.validationCode}
                      </div>
                      {cert.issuedAt && (
                        <div className="text-[10px] text-ink-subtle mt-0.5">
                          Emitido em {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[11px] text-ink-muted mb-1">
                      {cert.progress}% concluído
                    </div>
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
      </section>

      <section>
        <h3 className="text-sm font-semibold text-pco-deep mb-3">
          Disponíveis para emissão manual · {eligibleCourses.length}
        </h3>
        {eligibleCourses.length === 0 ? (
          <div className="pco-card text-center py-6 text-sm text-ink-muted">
            Aluno já tem certificado em todos os cursos matriculados.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {eligibleCourses.map((c) => {
              const progress = student.progressByCourse?.[c.id] ?? 0;
              const certEnabled = c.certificateAvailable !== false;
              return (
                <div
                  key={c.id}
                  className="pco-card flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-pco-blue/10 grid place-items-center shrink-0">
                    <Award size={16} className="text-pco-blue" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-pco-deep truncate">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-ink-subtle">
                      {progress}% concluído
                      {!certEnabled && (
                        <span className="ml-2 pco-badge bg-status-warning/10 text-status-warning">
                          Emissão desabilitada
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleIssue(c.id, c.title)}
                    disabled={issueMut.isPending || !certEnabled}
                    className="pco-btn-primary text-xs whitespace-nowrap"
                    title={
                      !certEnabled
                        ? 'Habilite a emissão no editor do curso → aba Certificado'
                        : `Emitir certificado para ${student.name}`
                    }
                  >
                    {issueMut.isPending ? (
                      <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <Plus size={12} strokeWidth={2} />
                    )}
                    Emitir
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
