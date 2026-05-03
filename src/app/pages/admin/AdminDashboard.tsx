import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  GraduationCap,
  Award,
  Bot,
  Mic2,
  Send,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
} from 'lucide-react';
import { retentionRisks } from '../../data/seed';

const kpis = [
  { icon: Users, label: 'Alunos ativos', value: '342', delta: '+8%', positive: true, color: 'blue' },
  { icon: AlertTriangle, label: 'Em risco', value: '47', delta: '+3', positive: false, color: 'orange' },
  { icon: GraduationCap, label: 'Cursos ativos', value: '3', delta: '0', positive: true, color: 'cyan' },
  { icon: TrendingUp, label: 'Taxa conclusão', value: '64%', delta: '+4pp', positive: true, color: 'green' },
  { icon: Award, label: 'Certificados', value: '128', delta: '+12', positive: true, color: 'gold' },
  { icon: Bot, label: 'Tutor (uso)', value: '1.2k', delta: '+22%', positive: true, color: 'blue' },
  { icon: Mic2, label: 'PCO POD plays', value: '870', delta: '+18%', positive: true, color: 'cyan' },
  { icon: Send, label: 'Reengajados', value: '23', delta: '+9', positive: true, color: 'orange' },
] as const;

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-pco-blue/10', text: 'text-pco-blue' },
  cyan: { bg: 'bg-pco-cyan/15', text: 'text-pco-cyan' },
  orange: { bg: 'bg-pco-orange/10', text: 'text-pco-orange' },
  green: { bg: 'bg-status-success/10', text: 'text-status-success' },
  gold: { bg: 'bg-status-gold/15', text: 'text-status-gold' },
};

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Dashboard Pedagógico</h1>
        <p className="pco-section-subtitle mt-1">
          Visão geral de retenção, conteúdo, certificados e uso do AVA.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const c = colorMap[k.color];
          return (
            <div key={k.label} className="pco-card">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                  {k.label}
                </div>
                <div className={`h-8 w-8 rounded-lg grid place-items-center ${c.bg}`}>
                  <Icon size={16} className={c.text} strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-bold tracking-tight text-pco-deep">{k.value}</div>
                <span
                  className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${
                    k.positive ? 'text-status-success' : 'text-status-danger'
                  }`}
                >
                  {k.positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {k.delta}
                </span>
              </div>
            </div>
          );
        })}
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
                <div className="text-[11px] mt-1">{b.label}</div>
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
                  <div className="text-[11px] text-ink-subtle truncate">
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
