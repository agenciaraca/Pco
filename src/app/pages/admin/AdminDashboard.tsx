import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  GraduationCap,
  Award,
  ArrowRight,
  Send,
  TrendingUp,
} from 'lucide-react';
import {
  useHealth,
  useRetentionRisks,
  useAdminStudents,
  useCourses,
  useAllCertificates,
  useAuditLog,
  useCompletionsStats,
  useAdminAlerts,
  useAdminKpis,
} from '../../data/hooks';
import { Cpu, HardDrive, AlertOctagon, Clock, History, ScrollText } from 'lucide-react';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import Sparkline from '../../components/Sparkline';
import { useT } from '../../i18n';

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/**
 * Painel que não carregou **diz** que não carregou.
 *
 * Os três cartões abaixo faziam `if (!data) return null`: em erro ou sem rede
 * eles simplesmente desapareciam, e o painel ficava com aparência de completo
 * sem eles. Um número ausente é lido como "não houve", que é o oposto de "não
 * medi" — a mesma regra das telas de métrica, aqui aplicada ao cartão inteiro.
 *
 * É uma linha, e não um cartão de erro cheio: dentro de uma grade de cartões
 * pequenos, o aviso tem de caber no lugar do que faltou.
 */
function PainelIndisponivel({ titulo }: { titulo: string }) {
  return (
    <div className="pco-card p-4">
      <h3 className="text-sm font-semibold text-pco-deep">{titulo}</h3>
      <p className="text-xs text-ink-subtle mt-2">
        Não consegui carregar agora. Atualize a página para tentar de novo.
      </p>
    </div>
  );
}

function KpisHeader() {
  const q = useAdminKpis();
  const { data } = q;
  if (q.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pco-card p-4 animate-pulse">
            <div className="h-3 w-24 bg-surface-mute rounded mb-2" />
            <div className="h-7 w-32 bg-surface-mute rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (!data) return <PainelIndisponivel titulo="Indicadores" />;
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: data.revenue.currency });

  function delta(pct: number, label = '30d'): React.ReactNode {
    if (pct === 0) return <span className="text-ink-subtle">±0% {label}</span>;
    const positive = pct > 0;
    return (
      <span className={positive ? 'text-status-success' : 'text-status-danger'}>
        {positive ? '↑' : '↓'} {Math.abs(pct)}% {label}
      </span>
    );
  }

  const cards = [
    {
      label: 'Receita líquida',
      value: fmt.format(data.revenue.netCents / 100),
      sub: `${fmt.format(data.revenue.last30DaysCents / 100)} nos últimos 30d`,
      delta: delta(data.revenue.deltaPct),
      color: 'text-pco-blue',
      Icon: TrendingUp,
    },
    {
      /*
        "Contas", não "alunos ativos".

        Este card e o de fichas, dois centímetros abaixo, mostravam **2028** e
        **1613** sob o mesmo rótulo "Alunos ativos". Os dois números estão
        certos e contam coisas diferentes: aqui são contas com papel de aluno e
        acesso liberado; ali, fichas de aluno com matrícula e progresso. Rótulo
        igual sobre números diferentes é a tela discordando de si mesma na mesma
        dobra — o mesmo defeito que a home teve.
      */
      label: 'Contas de aluno',
      value: String(data.students.active),
      sub: `podem entrar · ${data.students.new30Days} criada(s) em 30d`,
      delta: delta(data.students.deltaPct),
      color: 'text-pco-cyan',
      Icon: Users,
    },
    {
      label: 'Certificados emitidos',
      value: String(data.completion.certificatesIssued),
      sub: `${data.completion.issuedLast30Days} nos últimos 30d`,
      delta: null,
      color: 'text-pco-orange',
      Icon: Award,
    },
    {
      label: 'Avaliação média',
      value:
        data.satisfaction.reviewCount > 0
          ? `${data.satisfaction.averageRating.toFixed(1)} ★`
          : '—',
      sub: `${data.satisfaction.reviewCount} avaliação(ões)`,
      delta: null,
      color: 'text-status-success',
      Icon: GraduationCap,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.Icon;
        return (
          <div key={c.label} className="pco-card p-4">
            <div className="flex items-center gap-2">
              <Icon size={14} strokeWidth={2} className={c.color} />
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                {c.label}
              </span>
            </div>
            <div className="text-2xl font-bold text-pco-deep mt-1.5">{c.value}</div>
            <div className="text-xs text-ink-subtle mt-1">{c.sub}</div>
            {c.delta && <div className="text-xs font-semibold mt-1">{c.delta}</div>}
          </div>
        );
      })}
    </div>
  );
}

function CompletionsCard() {
  const { data } = useCompletionsStats(7);
  if (!data) return <PainelIndisponivel titulo="Aulas concluídas" />;
  const today = data.series[data.series.length - 1]?.count ?? 0;
  return (
    <div className="pco-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pco-deep">Aulas concluídas</h3>
        <span className="text-xs text-ink-subtle">últimos {data.days} dias</span>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <div className="text-2xl font-bold text-pco-deep">{data.total}</div>
          <div className="text-xs text-ink-subtle">
            total · hoje: <strong className="text-pco-blue">{today}</strong>
          </div>
        </div>
        <div className="flex-1">
          <Sparkline
            data={data.series.map((d) => ({ label: d.day, value: d.count }))}
            height={48}
            showValueLabels
          />
        </div>
      </div>
    </div>
  );
}

function HealthMiniCard() {
  const { data } = useHealth();
  if (!data) return <PainelIndisponivel titulo="Saúde do sistema" />;
  const lastBackup = data.lastBackupAt
    ? new Date(data.lastBackupAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const items = [
    { Icon: Clock, label: 'Uptime', value: formatUptime(data.uptimeSec), color: 'text-pco-blue' },
    { Icon: Cpu, label: 'Memória', value: `${data.memMB} MB`, color: 'text-pco-cyan' },
    { Icon: HardDrive, label: 'Dados', value: `${data.dataSizeMB} MB`, color: 'text-status-success' },
    {
      Icon: AlertOctagon,
      label: 'Erros 24h',
      value: String(data.errors24h),
      color: data.errors24h > 0 ? 'text-status-danger' : 'text-ink-muted',
    },
    { Icon: HardDrive, label: 'Último backup', value: lastBackup, color: 'text-pco-orange' },
  ];
  return (
    <div className="pco-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pco-deep">Saúde do sistema</h3>
        <span className="text-xs text-ink-subtle">
          {data.db === 'connected' ? 'DB conectado' : 'JSON fallback'} · node {data.nodeVersion}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((it) => {
          const Icon = it.Icon;
          return (
            <div key={it.label} className="rounded-lg bg-surface-mute/40 p-3">
              <div className="flex items-center gap-1.5">
                <Icon size={12} strokeWidth={2} className={it.color} />
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  {it.label}
                </span>
              </div>
              <div className="mt-1 text-lg font-bold text-pco-deep">{it.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-pco-blue/10', text: 'text-pco-blue' },
  cyan: { bg: 'bg-pco-cyan/15', text: 'text-pco-cyan' },
  orange: { bg: 'bg-pco-orange/10', text: 'text-pco-orange' },
  green: { bg: 'bg-status-success/10', text: 'text-status-success' },
  gold: { bg: 'bg-status-gold/15', text: 'text-status-gold' },
};

function formatTs(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}min atrás`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function AdminDashboard() {
  const t = useT();
  const { data: retentionRisks = [] } = useRetentionRisks();
  // Mesma chave do card de contas lá em cima: o TanStack devolve o cache, não
  // faz uma segunda requisição. É o que permite comparar os dois números aqui.
  const kpisQ = useAdminKpis();
  const studentsQ = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const coursesQ = useCourses();
  const certsQ = useAllCertificates();
  const auditQ = useAuditLog({ limit: 8 });
  const alertsQ = useAdminAlerts();
  useDocumentMeta({ title: 'Painel Admin — AVA PCO' });

  const students = studentsQ.data ?? [];
  const courses = coursesQ.data ?? [];
  const certs = certsQ.data ?? [];
  const audit = auditQ.data ?? [];

  const activeStudents = students.filter((s) => s.status === 'ativo').length;
  // Contas com papel de aluno que não têm ficha. `kpis` vem do servidor e conta
  // contas; `students` vem do catálogo de fichas.
  const contasDeAluno = kpisQ.data?.students.active ?? 0;
  const semFicha = Math.max(0, contasDeAluno - students.length);
  const atRisk = students.filter((s) => s.status === 'em_risco').length;
  const blocked = students.filter((s) => s.status === 'bloqueado').length;
  const issuedCerts = certs.filter((c) => c.status === 'issued').length;

  const dynamicKpis = [
    {
      icon: Users,
      /*
        A ficha é o que tem matrícula, progresso e prazo de acesso. A conta é
        só o login. A diferença entre as duas não é ruído: são pessoas que
        conseguem entrar e para quem o catálogo não devolve matrícula nenhuma —
        eram 418 em produção quando isso foi medido pela primeira vez. Mostrar
        a diferença aqui é mais útil do que repetir o total.
      */
      label: 'Fichas de aluno',
      value: String(activeStudents),
      sub:
        semFicha > 0
          ? `${semFicha} conta(s) sem ficha`
          : `de ${students.length} cadastrada(s)`,
      color: 'blue' as const,
    },
    {
      icon: AlertTriangle,
      label: 'Em risco',
      value: String(atRisk),
      sub: `${blocked} bloqueado${blocked === 1 ? '' : 's'}`,
      color: 'orange' as const,
    },
    {
      icon: GraduationCap,
      label: 'Cursos ativos',
      value: String(courses.length),
      sub:
        courses.reduce(
          (s, c) => s + c.modules.reduce((mm, m) => mm + (m.lessons?.length ?? 0), 0),
          0,
        ) + ' aulas total',
      color: 'cyan' as const,
    },
    {
      icon: Award,
      label: 'Certificados emitidos',
      value: String(issuedCerts),
      sub: `${certs.length - issuedCerts} em andamento`,
      color: 'gold' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('admin.nav.dashboard')}</h1>
        <p className="pco-section-subtitle mt-1">
          Visão geral de retenção, conteúdo, certificados e uso do AVA.
        </p>
      </header>

      <KpisHeader />

      {alertsQ.data && alertsQ.data.total > 0 && (
        <Link
          to="/admin/saude"
          className={`pco-card pco-card-hover p-4 flex items-start gap-3 block ${
            alertsQ.data.error > 0
              ? 'border-status-danger/40 bg-status-danger/5'
              : 'border-pco-orange/40 bg-pco-orange/5'
          }`}
        >
          <AlertTriangle
            size={20}
            className={
              alertsQ.data.error > 0
                ? 'text-status-danger shrink-0'
                : 'text-pco-orange shrink-0'
            }
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-pco-deep">
              {alertsQ.data.total} alerta{alertsQ.data.total !== 1 ? 's' : ''} requer{alertsQ.data.total !== 1 ? 'em' : ''} atenção
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              {alertsQ.data.error > 0 && (
                <span className="text-status-danger font-semibold">
                  {alertsQ.data.error} erro{alertsQ.data.error !== 1 ? 's' : ''}
                </span>
              )}
              {alertsQ.data.error > 0 && alertsQ.data.warn > 0 && ' · '}
              {alertsQ.data.warn > 0 && (
                <span className="text-pco-orange font-semibold">
                  {alertsQ.data.warn} aviso{alertsQ.data.warn !== 1 ? 's' : ''}
                </span>
              )}
              <span className="ml-2 text-ink-subtle">
                {alertsQ.data.items
                  .slice(0, 3)
                  .map((i) => i.label)
                  .join(' · ')}
                {alertsQ.data.items.length > 3 ? ' ...' : ''}
              </span>
            </div>
          </div>
          <span className="text-pco-blue text-xs shrink-0">Ver detalhes →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <CompletionsCard />
        <HealthMiniCard />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dynamicKpis.map((k) => {
          const Icon = k.icon;
          const c = colorMap[k.color];
          return (
            <div key={k.label} className="pco-card">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
                  {k.label}
                </div>
                <div className={`h-8 w-8 rounded-lg grid place-items-center ${c.bg}`}>
                  <Icon size={16} className={c.text} strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-pco-deep">
                {k.value}
              </div>
              {k.sub && <div className="text-xs text-ink-subtle mt-0.5">{k.sub}</div>}
            </div>
          );
        })}
      </section>

      <section className="pco-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <History size={16} className="text-pco-blue" strokeWidth={1.75} />
            Atividade recente
          </h3>
          <Link to="/admin/auditoria" className="text-xs text-pco-blue hover:underline">
            Ver auditoria completa →
          </Link>
        </div>
        {audit.length === 0 ? (
          <p className="text-xs text-ink-muted">Sem ações registradas ainda.</p>
        ) : (
          <ul className="divide-y divide-surface-mute">
            {audit.map((e) => (
              <li key={e.id} className="py-2 flex items-start gap-2 text-xs">
                <ScrollText size={12} strokeWidth={2} className="text-ink-muted mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-semibold text-pco-deep truncate">
                      {e.actorEmail ?? 'sistema'}
                    </span>
                    <code className="text-xs text-pco-blue truncate">{e.action}</code>
                    {e.targetId && (
                      <span className="text-xs text-ink-muted truncate">
                        · {e.targetId}
                      </span>
                    )}
                    <span
                      className={
                        e.status === 'ok'
                          ? 'pco-badge bg-status-success/10 text-status-success'
                          : 'pco-badge bg-status-danger/15 text-status-danger'
                      }
                    >
                      {e.status}
                    </span>
                  </div>
                </div>
                <span className="text-ink-subtle shrink-0">{formatTs(e.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 pco-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-pco-deep">Acessos recentes</h3>
              <p className="text-xs text-ink-muted">Janelas de inatividade</p>
            </div>
            <Link to="/admin/evasao" className="text-xs text-pco-blue hover:underline">
              Ver previsão de evasão →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sem acesso 7d', value: 38, color: 'bg-pco-orange/15 text-pco-orange' },
              { label: 'Sem acesso 14d', value: 19, color: 'bg-pco-orange/25 text-pco-orange' },
              { label: 'Sem acesso 30d', value: 12, color: 'bg-status-danger/15 text-status-danger' },
            ].map((b) => (
              <div key={b.label} className={`rounded-xl p-4 ${b.color}`}>
                <div className="text-2xl font-bold">{b.value}</div>
                <div className="text-xs mt-1">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pco-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-pco-deep">Top risco</h3>
            <Link to="/admin/evasao" className="text-xs text-pco-blue hover:underline">
              Todos →
            </Link>
          </div>
          <ul className="space-y-3">
            {retentionRisks.slice(0, 3).map((r) => (
              <li key={r.studentId} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white">
                  {r.studentName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep truncate">
                    {r.studentName}
                  </div>
                  <div className="text-xs text-ink-subtle truncate">
                    {r.reasons[0]}
                  </div>
                </div>
                <span
                  className={`pco-badge ${
                    r.level === 'critico'
                      ? 'bg-status-danger/15 text-status-danger'
                      : r.level === 'alto'
                        ? 'bg-pco-orange/15 text-pco-orange'
                        : 'bg-pco-blue/10 text-pco-blue'
                  }`}
                >
                  {r.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Link to="/admin/cursos" className="pco-card pco-card-hover">
          <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center mb-3">
            <GraduationCap size={18} className="text-pco-blue" strokeWidth={1.75} />
          </div>
          <div className="font-semibold text-pco-deep">Gestão de cursos</div>
          <p className="mt-1 text-xs text-ink-muted">Editar módulos, aulas e regras de cada curso.</p>
          <div className="mt-3 inline-flex items-center gap-1 text-xs text-pco-blue">
            Acessar
            <ArrowRight size={12} strokeWidth={2} />
          </div>
        </Link>
        <Link to="/admin/plano-retomada-ia" className="pco-card pco-card-hover">
          <div className="h-10 w-10 rounded-xl bg-pco-orange/10 grid place-items-center mb-3">
            <Send size={18} className="text-pco-orange" strokeWidth={1.75} />
          </div>
          <div className="font-semibold text-pco-deep">Plano de Retomada com IA</div>
          <p className="mt-1 text-xs text-ink-muted">
            Gere planos personalizados para alunos em risco.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-xs text-pco-blue">
            Acessar
            <ArrowRight size={12} strokeWidth={2} />
          </div>
        </Link>
        <Link to="/admin/metricas" className="pco-card pco-card-hover">
          <div className="h-10 w-10 rounded-xl bg-status-success/10 grid place-items-center mb-3">
            <TrendingUp size={18} className="text-status-success" strokeWidth={1.75} />
          </div>
          <div className="font-semibold text-pco-deep">Métricas & SEO</div>
          <p className="mt-1 text-xs text-ink-muted">
            Acompanhe site, SEO, palavras-chave e indexação.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-xs text-pco-blue">
            Acessar
            <ArrowRight size={12} strokeWidth={2} />
          </div>
        </Link>
      </section>
    </div>
  );
}
