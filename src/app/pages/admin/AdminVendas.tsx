import { useState } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  DollarSign,
  ShoppingBag,
  AlertCircle,
  Award,
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
  Legend,
} from 'recharts';
import { useSalesSummary } from '../../data/hooks';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import { ROTULO_METODO } from '../../../../shared/metodos-pagamento';
import type { SalesSummaryDto } from '../../data/api';

const RANGES = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

const STATUS_COLORS: Record<string, string> = {
  paid: '#15803d',
  pending: '#fb923c',
  processing: '#0097B2',
  canceled: '#94a3b8',
  failed: '#dc2626',
  refunded: '#0CC0DF',
};

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  processing: 'Processando',
  canceled: 'Cancelado',
  failed: 'Falhou',
  refunded: 'Reembolsado',
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function AdminVendas() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.salesAnalytics')} — Admin AVA PCO` });
  const [days, setDays] = useState(30);
  const q = useSalesSummary(days);
  const { data, refetch, isFetching } = q;

  // `isLoading || !data` mandava erro e falta de rede para o mesmo esqueleto,
  // que então girava para sempre: quem olhava concluía que o sistema estava
  // lento, e não que a requisição tinha morrido.
  if (q.fetchStatus === 'paused') return <SemConexao oQue="o resumo de vendas" />;
  if (q.isPending) return <CardListSkeleton count={4} />;
  if (q.isError || !data)
    return (
      <FalhaAoCarregar
        erro={q.error}
        oQue="o resumo de vendas"
        aoTentarDeNovo={() => void refetch()}
      />
    );

  const series = data.series.map((p) => ({
    date: new Date(p.date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
    revenue: p.revenueCents / 100,
    orders: p.orders,
  }));

  const statusPie = (Object.keys(data.statusDistribution) as Array<
    keyof typeof data.statusDistribution
  >)
    .filter((s) => data.statusDistribution[s] > 0)
    .map((s) => ({
      name: STATUS_LABELS[s] ?? s,
      value: data.statusDistribution[s],
      color: STATUS_COLORS[s] ?? '#94a3b8',
    }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <TrendingUp size={20} className="text-pco-blue" strokeWidth={1.75} />
            {t('admin.nav.salesAnalytics')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Análise de pedidos pagos no período. Comparado com período anterior
            de igual duração.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-pco-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setDays(r.value)}
                className={`px-3 py-1.5 text-xs ${
                  days === r.value
                    ? 'bg-pco-blue/10 text-pco-blue font-semibold'
                    : 'text-ink-muted hover:bg-surface-mute'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="pco-btn-ghost text-xs"
          >
            <RefreshCw
              size={11}
              strokeWidth={2}
              className={isFetching ? 'animate-spin' : ''}
            />
            Atualizar
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Receita líquida"
          value={formatBRL(data.totals.revenueCents - data.totals.refundedCents)}
          deltaPct={data.comparison.revenuePctChange}
          icon={<DollarSign size={14} className="text-status-success" />}
        />
        <KpiCard
          label="Pedidos pagos"
          value={data.totals.paidOrders.toString()}
          deltaPct={data.comparison.ordersPctChange}
          icon={<ShoppingBag size={14} className="text-pco-blue" />}
        />
        <KpiCard
          label="Reembolsos"
          value={formatBRL(data.totals.refundedCents)}
          subtitle={`${data.totals.refundedOrders} pedido(s)`}
          icon={<AlertCircle size={14} className="text-pco-cyan" />}
        />
        <KpiCard
          label="Pendentes"
          value={data.totals.pendingOrders.toString()}
          subtitle="aguardando pagamento"
          icon={<Award size={14} className="text-pco-orange" />}
        />
      </div>

      <section className="pco-card p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-pco-deep">
            Receita diária ({data.range.days} dias)
          </h2>
          <span className="text-xs text-ink-subtle">
            Total: {formatBRL(data.totals.revenueCents)}
          </span>
        </div>
        {series.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="revenueG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0097B2" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0097B2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={10} stroke="#64748b" />
              <YAxis fontSize={10} stroke="#64748b" />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number, name: string) =>
                  name === 'revenue'
                    ? [
                        v.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }),
                        'Receita',
                      ]
                    : [v, 'Pedidos']
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0097B2"
                fill="url(#revenueG)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="Sem vendas no período"
            description="Tente um intervalo maior."
            icon={<TrendingUp size={28} className="text-pco-blue" />}
          />
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="pco-card p-4">
          <h2 className="text-sm font-semibold text-pco-deep mb-3">
            Top produtos por receita
          </h2>
          {data.topProducts.length > 0 ? (
            <ul className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li
                  key={p.productId}
                  className="flex items-center gap-3 p-2 rounded hover:bg-surface-mute"
                >
                  <span className="h-6 w-6 rounded-full bg-pco-blue/10 text-pco-blue grid place-items-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {p.orders} pedido(s)
                    </div>
                  </div>
                  <span className="text-sm font-bold text-status-success">
                    {formatBRL(p.revenueCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Sem produtos vendidos.</p>
          )}
        </section>

        <section className="pco-card p-4">
          <h2 className="text-sm font-semibold text-pco-deep mb-3">
            Distribuição de status
          </h2>
          {statusPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusPie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-ink-muted">Sem pedidos.</p>
          )}
        </section>
      </div>

      <PorMetodo dados={data.porMetodo} total={data.totals.revenueCents} />
    </div>
  );
}

/**
 * Quanto do dinheiro entra por cada método.
 *
 * A escola roteia gateway **por método** desde 5/set/2026, e a decisão que isso
 * exige — ligar boleto, negociar taxa de cartão, deixar de oferecer pix — não
 * tinha número em tela nenhuma para se apoiar.
 *
 * Duas regras deste projeto valem aqui e mudam o desenho:
 *
 * - **Percentual anda com a base.** "62%" sozinho não deixa ninguém
 *   desconfiar; "62% de R$ 12.480" denuncia o problema quando o total está
 *   errado.
 * - **Ausência não é zero.** Pedido pago antes de o campo `metodo` existir não
 *   é pix nem cartão: aparece à parte, dito. Diluí-lo inflaria o número que a
 *   coordenação leva para a negociação com o gateway.
 */
function PorMetodo({
  dados,
  total,
}: {
  dados: SalesSummaryDto['porMetodo'];
  total: number;
}) {
  const comVenda = dados.itens.filter((i) => i.orders > 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : null);

  return (
    <section className="pco-card p-4">
      <h2 className="text-sm font-semibold text-pco-deep mb-1">
        Receita paga por método
      </h2>
      <p className="text-xs text-ink-muted mb-3">
        Só pedidos pagos. Pendente não é receita — contá-lo aqui faria o boleto
        parecer vender o que ele deixa em aberto.
      </p>

      {comVenda.length === 0 && dados.semMetodo.orders === 0 ? (
        <p className="text-sm text-ink-muted">Sem pagamento no período.</p>
      ) : (
        <ul className="space-y-2">
          {comVenda.map((i) => {
            const p = pct(i.revenueCents);
            return (
              <li key={i.metodo} className="flex items-center gap-3">
                <span className="text-sm text-pco-deep w-24 shrink-0">
                  {ROTULO_METODO[i.metodo]}
                </span>
                <div className="flex-1 h-2 rounded-full bg-surface-gray overflow-hidden">
                  <div
                    className="h-full bg-pco-blue"
                    style={{ width: `${p ?? 0}%` }}
                  />
                </div>
                <span className="text-xs text-ink-muted w-14 text-right tabular-nums">
                  {p === null ? '—' : `${p}%`}
                </span>
                <span className="text-sm font-bold text-pco-deep w-28 text-right tabular-nums">
                  {formatBRL(i.revenueCents)}
                </span>
                <span className="text-xs text-ink-subtle w-28 text-right">
                  {i.orders} pedido(s)
                  {i.carnes > 0 && ` · ${i.carnes} em carnê`}
                </span>
              </li>
            );
          })}

          {dados.semMetodo.orders > 0 && (
            <li className="flex items-center gap-3 pt-2 border-t border-border-subtle">
              <span className="text-sm text-ink-subtle w-24 shrink-0">
                Não registrado
              </span>
              <span className="flex-1 text-xs text-ink-subtle">
                Pagos antes de 5/set/2026, quando o método passou a ser gravado.
              </span>
              <span className="text-sm font-bold text-ink-muted w-28 text-right tabular-nums">
                {formatBRL(dados.semMetodo.revenueCents)}
              </span>
              <span className="text-xs text-ink-subtle w-28 text-right">
                {dados.semMetodo.orders} pedido(s)
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  deltaPct,
  icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  deltaPct?: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="pco-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-pco-deep">{value}</div>
      {subtitle && (
        <div className="text-xs text-ink-subtle mt-0.5">{subtitle}</div>
      )}
      {deltaPct !== undefined && deltaPct !== null && (
        <div
          className={`text-xs mt-1 inline-flex items-center gap-1 font-semibold ${
            deltaPct > 0
              ? 'text-status-success'
              : deltaPct < 0
                ? 'text-status-danger'
                : 'text-ink-muted'
          }`}
        >
          {deltaPct > 0 ? (
            <ArrowUpRight size={11} />
          ) : deltaPct < 0 ? (
            <ArrowDownRight size={11} />
          ) : (
            <Minus size={11} />
          )}
          {Math.abs(deltaPct).toFixed(1)}% vs período anterior
        </div>
      )}
    </div>
  );
}
