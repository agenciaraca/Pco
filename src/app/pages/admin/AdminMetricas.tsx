import {
  Users,
  Eye,
  Activity,
  Clock,
  Gauge,
  Download,
  RefreshCcw,
  Smartphone,
  Tablet,
  Monitor,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShieldCheck,
  AlertTriangle,
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
import { useTrafego } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useT } from '../../i18n';

/**
 * Até 27/ago/2026 esta tela era três quartos ficção: origem do tráfego,
 * páginas mais acessadas, dispositivos, SEO técnico e as recomendações eram
 * constantes escritas à mão neste arquivo, e a série vinha da semente. Agora
 * cada número aqui saiu de `server/analytics/` — e onde não há medição a tela
 * diz que não há, em vez de preencher com algo plausível.
 *
 * A regra que sobrou desse conserto: **campo `null` não vira zero**. Zero diz
 * "medi e não houve"; travessão diz "não medi". São coisas diferentes para
 * quem decide investimento olhando esta página.
 */

/** Paleta fixa por origem — cor estável entre recarregamentos. */
const COR_DA_ORIGEM: Record<string, string> = {
  'Orgânico': '#0097B2',
  Direto: '#0CC0DF',
  Social: '#FE9002',
  Referral: '#5CE1E6',
  'E-mail': '#063B49',
};

const ICONE_DO_DEVICE: Record<string, React.ReactNode> = {
  Desktop: <Monitor size={16} />,
  Mobile: <Smartphone size={16} />,
  Tablet: <Tablet size={16} />,
};

function fmtNumero(n: number): string {
  return n.toLocaleString('pt-BR');
}

function fmtDuracao(segundos: number | null): string {
  if (segundos === null) return '—';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function AdminMetricas() {
  const t = useT();
  const [range, setRange] = useState('30d');
  const q = useTrafego(range);
  const rel = q.data;

  return (
    <div className="space-y-6">
      {rel && (
        <div
          className={`pco-card p-4 ${
            rel.medindoDesde ? 'border-status-success/40 bg-status-success/5' : 'border-pco-orange/40 bg-pco-orange/5'
          }`}
        >
          <p
            className={`flex items-center gap-2 text-sm font-semibold ${
              rel.medindoDesde ? 'text-status-success' : 'text-pco-orange'
            }`}
          >
            <ShieldCheck size={14} strokeWidth={2} />
            {rel.medindoDesde
              ? `Medição própria — desde ${fmtData(rel.medindoDesde)}`
              : 'Medição própria ligada, ainda sem visita registrada'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{rel.status.observacao}</p>
          {rel.diasComDados < 7 && rel.medindoDesde && (
            <p className="mt-1 text-xs text-ink-subtle">
              Só {rel.diasComDados} {rel.diasComDados === 1 ? 'dia tem' : 'dias têm'} medição neste
              período — comparações com o período anterior ainda não significam muito.
            </p>
          )}
        </div>
      )}

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.metrics')}</h1>
          <p className="pco-section-subtitle mt-1">
            Tráfego do site, medido pelo próprio servidor — sem cookie, sem IP e sem Google
            Analytics. Navegação em /admin não é contada.
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
          <button
            type="button"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
            className="pco-btn-secondary text-xs disabled:opacity-60"
          >
            <RefreshCcw size={12} strokeWidth={2} />
            {q.isFetching ? 'Atualizando…' : 'Atualizar'}
          </button>
          {/*
            Exportar continua não existindo. A diferença é que agora o motivo
            mudou: não é mais "não há o que exportar", é "ainda não foi feito".
          */}
          <button
            type="button"
            disabled
            title="Exportação ainda não implementada."
            className="pco-btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={12} strokeWidth={2} />
            Exportar relatório
          </button>
        </div>
      </header>

      {q.isLoading && <CardListSkeleton />}

      {q.isError && (
        <div className="pco-card border-status-danger/40 bg-status-danger/5 p-4">
          <p className="text-sm font-semibold text-status-danger">
            Não foi possível carregar a medição.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            A tela prefere não mostrar nada a mostrar número velho como se fosse de agora.
          </p>
        </div>
      )}

      {rel && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Metric
              icon={<Users size={16} />}
              label="Visitantes"
              value={fmtNumero(rel.resumo.visitors)}
              delta={rel.resumo.deltaVisitors}
              color="blue"
            />
            <Metric
              icon={<Eye size={16} />}
              label="Pageviews"
              value={fmtNumero(rel.resumo.pageviews)}
              delta={rel.resumo.deltaPageviews}
              color="cyan"
            />
            <Metric
              icon={<Activity size={16} />}
              label="Taxa de rejeição"
              value={rel.resumo.bounceRate === null ? '—' : `${rel.resumo.bounceRate}%`}
              delta={null}
              color="green"
            />
            <Metric
              icon={<Clock size={16} />}
              label="Tempo médio"
              value={
                rel.resumo.avgSessionMinutes === null
                  ? '—'
                  : `${rel.resumo.avgSessionMinutes} min`
              }
              delta={null}
              color="cyan"
            />
            <Metric
              icon={<Gauge size={16} />}
              label="LCP (p75)"
              value={
                rel.resumo.lcpP75Ms === null
                  ? '—'
                  : `${(rel.resumo.lcpP75Ms / 1000).toFixed(2)}s`
              }
              delta={null}
              color={rel.resumo.lcpP75Ms !== null && rel.resumo.lcpP75Ms > 2500 ? 'orange' : 'gold'}
              nota={
                rel.resumo.lcpAmostras > 0
                  ? `${fmtNumero(rel.resumo.lcpAmostras)} amostras`
                  : 'sem amostra'
              }
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 pco-card">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-pco-deep">Evolução de acessos</h3>
                <p className="text-xs text-ink-muted">
                  Visitantes e pageviews — {fmtData(rel.de)} a {fmtData(rel.ate)}
                </p>
              </div>
              <div className="h-72 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rel.serie}>
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
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis stroke="#98A2B3" fontSize={10} width={40} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #EEF5F7', fontSize: 12 }}
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
              <p className="text-xs text-ink-muted mb-3">
                Classificada na primeira página de cada visita
              </p>
              {rel.sources.length === 0 ? (
                <SemMedicao texto="Nenhuma visita no período." />
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rel.sources}
                          dataKey="sessions"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {rel.sources.map((s) => (
                            <Cell
                              key={s.name}
                              fill={COR_DA_ORIGEM[s.name] ?? '#98A2B3'}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {rel.sources.map((s) => (
                      <li key={s.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: COR_DA_ORIGEM[s.name] ?? '#98A2B3' }}
                        />
                        <span className="text-ink-muted flex-1">{s.name}</span>
                        <span className="text-ink-subtle">{fmtNumero(s.sessions)}</span>
                        <span className="font-semibold text-pco-deep w-12 text-right">
                          {s.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1">Páginas mais acessadas</h3>
              <p className="text-xs text-ink-muted mb-3">
                Tempo é o intervalo até a página seguinte; rejeição só conta quem entrou por ali.
              </p>
              {rel.topPages.length === 0 ? (
                <SemMedicao texto="Nenhuma página vista no período." />
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-ink-subtle">
                        <th className="px-2 py-2 text-left font-medium">Página</th>
                        <th className="px-2 py-2 text-right font-medium">Views</th>
                        <th className="px-2 py-2 text-right font-medium">Tempo</th>
                        <th className="px-2 py-2 text-right font-medium">Rejeição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.topPages.map((p) => (
                        <tr key={p.path} className="border-t border-surface-gray">
                          <td className="px-2 py-2.5">
                            <span className="font-mono text-xs text-pco-deep">{p.path}</span>
                          </td>
                          <td className="px-2 py-2.5 text-right text-pco-deep font-semibold">
                            {fmtNumero(p.views)}
                          </td>
                          <td className="px-2 py-2.5 text-right text-ink-muted">
                            {fmtDuracao(p.avgSeconds)}
                          </td>
                          <td className="px-2 py-2.5 text-right text-ink-muted">
                            {p.bounceRate === null ? '—' : `${p.bounceRate}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1">
                Rotas que não existem
              </h3>
              <p className="text-xs text-ink-muted mb-3">
                Endereços em que o site caiu no 404 — link quebrado em algum lugar, ou página que
                mudou de endereço sem redirecionar.
              </p>
              {rel.notFound.length === 0 ? (
                <SemMedicao texto="Nenhum 404 no período." tom="bom" />
              ) : (
                <ul className="space-y-2">
                  {rel.notFound.map((n) => (
                    <li
                      key={n.path}
                      className="flex items-center justify-between rounded-xl bg-surface-off p-3"
                    >
                      <span className="font-mono text-xs text-pco-deep truncate">{n.path}</span>
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange shrink-0">
                        {n.hits}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1">SEO técnico</h3>
              <p className="text-xs text-ink-muted mb-3">
                Cada item é apurado agora — passe o mouse para ver de onde veio.
              </p>
              <ul className="space-y-2">
                {rel.tecnico.map((item) => (
                  <li
                    key={item.label}
                    title={item.fonte}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-off"
                  >
                    <span className="text-sm text-ink-muted">{item.label}</span>
                    <span
                      className={`pco-badge ${
                        item.status === 'ok'
                          ? 'bg-status-success/10 text-status-success'
                          : item.status === 'warn'
                            ? 'bg-pco-orange/10 text-pco-orange'
                            : 'bg-surface-gray text-ink-subtle'
                      }`}
                    >
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1">Dispositivos</h3>
              <p className="text-xs text-ink-muted mb-3">Por sessão, classificado no servidor</p>
              {rel.devices.length === 0 ? (
                <SemMedicao texto="Nenhuma visita no período." />
              ) : (
                <ul className="space-y-3">
                  {rel.devices.map((d) => (
                    <DeviceRow
                      key={d.name}
                      icon={ICONE_DO_DEVICE[d.name] ?? <Monitor size={16} />}
                      label={d.name}
                      pct={d.pct}
                      sessions={d.sessions}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1 flex items-center gap-2">
                <AlertTriangle size={16} className="text-pco-orange" strokeWidth={1.75} />
                O que esta tela não mede
              </h3>
              <p className="text-xs text-ink-muted mb-3">
                Listado em vez de estimado — número inventado aqui vira decisão errada lá fora.
              </p>
              <ul className="space-y-2 text-sm">
                {rel.status.semFonte.map((f) => (
                  <li key={f.o_que} className="flex items-start gap-2 text-ink-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-pco-orange shrink-0" />
                    <span>
                      {f.o_que}
                      <span className="block text-xs text-ink-subtle">
                        depende de: {f.depende_de}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SemMedicao({ texto, tom = 'neutro' }: { texto: string; tom?: 'neutro' | 'bom' }) {
  return (
    <p
      className={`rounded-xl bg-surface-off p-4 text-center text-xs ${
        tom === 'bom' ? 'text-status-success' : 'text-ink-subtle'
      }`}
    >
      {texto}
    </p>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  color,
  nota,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Variação % contra o período anterior. `null` quando não há base. */
  delta: number | null;
  color: 'blue' | 'cyan' | 'green' | 'orange' | 'gold';
  nota?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-pco-blue/10', text: 'text-pco-blue' },
    cyan: { bg: 'bg-pco-cyan/15', text: 'text-pco-cyan' },
    green: { bg: 'bg-status-success/10', text: 'text-status-success' },
    orange: { bg: 'bg-pco-orange/10', text: 'text-pco-orange' },
    gold: { bg: 'bg-status-gold/15', text: 'text-status-gold' },
  };
  const c = colorMap[color];
  const trend = delta === null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return (
    <div className="pco-card">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
          {label}
        </div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <div className="text-xl font-bold tracking-tight text-pco-deep">{value}</div>
        {delta !== null && (
          <span
            className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
              trend === 'up'
                ? 'text-status-success'
                : trend === 'down'
                  ? 'text-status-danger'
                  : 'text-ink-subtle'
            }`}
            title="Contra o período anterior de mesmo tamanho"
          >
            {trend === 'up' ? (
              <ArrowUpRight size={11} />
            ) : trend === 'down' ? (
              <ArrowDownRight size={11} />
            ) : (
              <Minus size={11} />
            )}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      {nota && <p className="mt-1 text-xs text-ink-subtle">{nota}</p>}
    </div>
  );
}

function DeviceRow({
  icon,
  label,
  pct,
  sessions,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  sessions: number;
}) {
  return (
    <li>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-pco-blue">{icon}</span>
        <span className="text-sm text-ink-muted flex-1">{label}</span>
        <span className="text-xs text-ink-subtle">{fmtNumero(sessions)}</span>
        <span className="text-xs font-semibold text-pco-deep w-11 text-right">{pct}%</span>
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
