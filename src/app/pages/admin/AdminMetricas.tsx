import {
  Users,
  Eye,
  Activity,
  Clock,
  Search,
  Gauge,
  Download,
  RefreshCcw,
  TrendingUp,
  Smartphone,
  Tablet,
  Monitor,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useState } from 'react';
import { useSeoTimeseries, useKeywords, useMetricsStatus } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useT } from '../../i18n';

// Os três blocos abaixo são de DEMONSTRAÇÃO: nunca vieram de medição nenhuma.
// Ficam para que o layout já exista quando a integração real chegar, e a tela
// avisa em cima que os números são fictícios — antes ela não avisava, e número
// com cara de medição é o pior lugar para esconder que não se mediu nada.
const trafficSources = [
  { name: 'Orgânico', value: 52, color: '#0097B2' },
  { name: 'Direto', value: 22, color: '#0CC0DF' },
  { name: 'Social', value: 14, color: '#FE9002' },
  { name: 'Referral', value: 8, color: '#5CE1E6' },
  { name: 'E-mail', value: 4, color: '#063B49' },
];

const topPages = [
  { path: '/cursos/psicanalise-clinica', views: 4820, avg: '3:42', bounce: '38%' },
  { path: '/jornada', views: 3210, avg: '4:21', bounce: '29%' },
  { path: '/news', views: 2105, avg: '2:18', bounce: '47%' },
  { path: '/podcasts', views: 1845, avg: '5:02', bounce: '24%' },
  { path: '/biblioteca', views: 1392, avg: '3:09', bounce: '40%' },
];

const techSeo = [
  { label: 'Velocidade média', value: '2.1s', status: 'ok' },
  { label: 'Mobile friendly', value: '100%', status: 'ok' },
  { label: 'HTTPS', value: 'Ativo', status: 'ok' },
  { label: 'Erros 404', value: '7', status: 'warn' },
  { label: 'Sitemap', value: 'OK', status: 'ok' },
  { label: 'robots.txt', value: 'OK', status: 'ok' },
];

export default function AdminMetricas() {
  const t = useT();
  const [range, setRange] = useState('30d');
  const seriesQ = useSeoTimeseries(range);
  const statusQ = useMetricsStatus();
  const keywordsQ = useKeywords();
  const seoTimeseries = seriesQ.data ?? [];
  const keywords = keywordsQ.data ?? [];
  const totalVisitors = seoTimeseries.reduce((s, d) => s + d.visitors, 0);
  const totalPageviews = seoTimeseries.reduce((s, d) => s + d.pageviews, 0);
  const avgBounce =
    seoTimeseries.length > 0
      ? seoTimeseries.reduce((s, d) => s + d.bounceRate, 0) / seoTimeseries.length
      : 0;
  const avgSession =
    seoTimeseries.length > 0
      ? seoTimeseries.reduce((s, d) => s + d.avgSessionMinutes, 0) / seoTimeseries.length
      : 0;

  return (
    <div className="space-y-6">
      {statusQ.data && !statusQ.data.conectado && (
        <div className="pco-card border-pco-orange/40 bg-pco-orange/5 p-4">
          <p className="text-sm font-semibold text-pco-orange">Números de demonstração</p>
          <p className="mt-1 text-xs text-ink-muted">{statusQ.data.observacao}</p>
        </div>
      )}

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.metrics')}</h1>
          <p className="pco-section-subtitle mt-1">
            Dashboard de desempenho do site e análise SEO.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="pco-input w-auto py-2 text-xs"
          >
            <option value="30d">Últimos 30 dias</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="365d">Este ano</option>
          </select>
          {/* Recarregar é o que "Atualizar" sempre prometeu e nunca fez. */}
          <button
            type="button"
            onClick={() => {
              void seriesQ.refetch();
              void keywordsQ.refetch();
            }}
            disabled={seriesQ.isFetching || keywordsQ.isFetching}
            className="pco-btn-secondary text-xs disabled:opacity-60"
          >
            <RefreshCcw size={12} strokeWidth={2} />
            {seriesQ.isFetching || keywordsQ.isFetching ? 'Atualizando…' : 'Atualizar'}
          </button>
          {/*
            Exportar relatório não existe, e enquanto os números forem de
            demonstração exportá-los seria pior do que não ter o botão: viraria
            planilha com cara de medição circulando por aí. Desabilitado e
            dizendo por quê, em vez de clicar e nada acontecer.
          */}
          <button
            type="button"
            disabled
            title={
              statusQ.data?.conectado
                ? 'Exportação ainda não implementada.'
                : 'Sem fonte de analytics conectada — não há o que exportar.'
            }
            className="pco-btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={12} strokeWidth={2} />
            Exportar relatório
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric
          icon={<Users size={16} />}
          label="Visitantes"
          value={totalVisitors.toLocaleString('pt-BR')}
          delta="+12%"
          trend="up"
          color="blue"
        />
        <Metric
          icon={<Eye size={16} />}
          label="Pageviews"
          value={totalPageviews.toLocaleString('pt-BR')}
          delta="+8%"
          trend="up"
          color="cyan"
        />
        <Metric
          icon={<Activity size={16} />}
          label="Taxa de rejeição"
          value={`${avgBounce.toFixed(1)}%`}
          delta="-1.4pp"
          trend="up"
          color="green"
        />
        <Metric
          icon={<Clock size={16} />}
          label="Tempo médio"
          value={`${avgSession.toFixed(1)} min`}
          delta="+0.3"
          trend="up"
          color="cyan"
        />
        <Metric
          icon={<Search size={16} />}
          label="Páginas indexadas"
          value="148"
          delta="+12"
          trend="up"
          color="orange"
        />
        <Metric
          icon={<Gauge size={16} />}
          label="Score SEO"
          value="86"
          delta="+4"
          trend="up"
          color="gold"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 pco-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-pco-deep">Evolução de acessos</h3>
              <p className="text-xs text-ink-muted">Visitantes e pageviews — últimos 30 dias</p>
            </div>
          </div>
          <div className="h-72 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={seoTimeseries}>
                <defs>
                  <linearGradient id="visGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0097B2" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0097B2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pvGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0CC0DF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0CC0DF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
                <XAxis
                  dataKey="date"
                  stroke="#98A2B3"
                  fontSize={10}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis stroke="#98A2B3" fontSize={10} width={40} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #EEF5F7',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pageviews"
                  stroke="#0CC0DF"
                  strokeWidth={2}
                  fill="url(#pvGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke="#0097B2"
                  strokeWidth={2}
                  fill="url(#visGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-1">Origem do tráfego</h3>
          <p className="text-xs text-ink-muted mb-3">Distribuição percentual</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trafficSources}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {trafficSources.map((s, i) => (
                    <Cell key={i} fill={s.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {trafficSources.map((s) => (
              <li key={s.name} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-ink-muted flex-1">{s.name}</span>
                <span className="font-semibold text-pco-deep">{s.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">Páginas mais acessadas</h3>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-2 py-2 text-left font-medium">Página</th>
                  <th className="px-2 py-2 text-right font-medium">Views</th>
                  <th className="px-2 py-2 text-right font-medium">Tempo</th>
                  <th className="px-2 py-2 text-right font-medium">Rejeição</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p) => (
                  <tr key={p.path} className="border-t border-surface-gray">
                    <td className="px-2 py-2.5">
                      <span className="font-mono text-[11px] text-pco-deep">{p.path}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-pco-deep font-semibold">
                      {p.views.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-muted">{p.avg}</td>
                    <td className="px-2 py-2.5 text-right text-ink-muted">{p.bounce}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">Palavras-chave</h3>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-2 py-2 text-left font-medium">Termo</th>
                  <th className="px-2 py-2 text-right font-medium">Pos.</th>
                  <th className="px-2 py-2 text-right font-medium">Volume</th>
                  <th className="px-2 py-2 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k) => (
                  <tr key={k.keyword} className="border-t border-surface-gray">
                    <td className="px-2 py-2.5 text-pco-deep flex items-center gap-1.5">
                      {k.trend === 'up' ? (
                        <ArrowUpRight size={12} className="text-status-success" />
                      ) : k.trend === 'down' ? (
                        <ArrowDownRight size={12} className="text-status-danger" />
                      ) : (
                        <Minus size={12} className="text-ink-subtle" />
                      )}
                      {k.keyword}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-pco-deep">
                      #{k.position}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-muted">
                      {k.searchVolume.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-muted">{k.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">SEO técnico</h3>
          <ul className="space-y-2">
            {techSeo.map((t) => (
              <li
                key={t.label}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-off"
              >
                <span className="text-sm text-ink-muted">{t.label}</span>
                <span
                  className={`pco-badge ${
                    t.status === 'ok'
                      ? 'bg-status-success/10 text-status-success'
                      : 'bg-pco-orange/10 text-pco-orange'
                  }`}
                >
                  {t.value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">Dispositivos</h3>
          <ul className="space-y-3">
            <DeviceRow icon={<Monitor size={16} />} label="Desktop" pct={58} />
            <DeviceRow icon={<Smartphone size={16} />} label="Mobile" pct={36} />
            <DeviceRow icon={<Tablet size={16} />} label="Tablet" pct={6} />
          </ul>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-pco-blue" strokeWidth={1.75} />
            Recomendações de melhoria
          </h3>
          <p className="text-xs text-ink-muted mb-3">Oportunidades para os próximos sprints de SEO</p>
          <ul className="space-y-2 text-sm">
            <Recommendation text="Atualizar meta descriptions em 14 páginas." />
            <Recommendation text="Reduzir LCP da home (3.4s → meta 2.5s)." />
            <Recommendation text="Adicionar schema.org Course nas páginas de curso." />
            <Recommendation text="Corrigir 7 links 404 internos." />
          </ul>
        </div>
      </section>

      <section className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-3">Status das integrações</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { name: 'Google Analytics', status: 'Não conectado' },
            { name: 'Google Search Console', status: 'Não conectado' },
            { name: 'API própria', status: 'Ativa (JSON local)' },
          ].map((i) => (
            <div
              key={i.name}
              className="flex items-center justify-between rounded-xl bg-surface-off p-3"
            >
              <span className="text-sm font-medium text-pco-deep">{i.name}</span>
              <span className="pco-badge bg-pco-orange/10 text-pco-orange">{i.status}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-subtle">
          Tela preparada para integração futura com Google Analytics, Search Console, CMS, API
          própria ou logs internos.
        </p>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  trend,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  color: 'blue' | 'cyan' | 'green' | 'orange' | 'gold';
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-pco-blue/10', text: 'text-pco-blue' },
    cyan: { bg: 'bg-pco-cyan/15', text: 'text-pco-cyan' },
    green: { bg: 'bg-status-success/10', text: 'text-status-success' },
    orange: { bg: 'bg-pco-orange/10', text: 'text-pco-orange' },
    gold: { bg: 'bg-status-gold/15', text: 'text-status-gold' },
  };
  const c = colorMap[color];

  return (
    <div className="pco-card">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
          {label}
        </div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <div className="text-xl font-bold tracking-tight text-pco-deep">{value}</div>
        <span
          className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${
            trend === 'up'
              ? 'text-status-success'
              : trend === 'down'
                ? 'text-status-danger'
                : 'text-ink-subtle'
          }`}
        >
          {trend === 'up' ? <ArrowUpRight size={11} /> : trend === 'down' ? <ArrowDownRight size={11} /> : <Minus size={11} />}
          {delta}
        </span>
      </div>
    </div>
  );
}

function DeviceRow({ icon, label, pct }: { icon: React.ReactNode; label: string; pct: number }) {
  return (
    <li>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-pco-blue">{icon}</span>
        <span className="text-sm text-ink-muted flex-1">{label}</span>
        <span className="text-xs font-semibold text-pco-deep">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function Recommendation({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-muted">
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-pco-blue shrink-0" />
      <span>{text}</span>
    </li>
  );
}
