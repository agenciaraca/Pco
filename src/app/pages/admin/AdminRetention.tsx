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
import { TrendingUp, ArrowUpRight, Users, Clock, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useRetencao } from '../../data/hooks';
import type { Medida } from '../../data/api';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useT } from '../../i18n';

/**
 * Até 27/ago/2026 esta tela inteira era invenção: os quatro KPIs eram strings
 * fixas, a curva de coorte era um array escrito à mão com três cursos que nem
 * são os do catálogo, e o gráfico de conclusão por curso fazia o pior: pegava
 * o **nome real** do curso e colava em cima um número de uma lista
 * `[64, 52, 71]`. Rótulo verdadeiro com valor inventado passa por conferência
 * — é mais perigoso do que ficção assumida.
 *
 * Agora tudo vem de `GET /admin/analytics/retencao`, e **todo percentual
 * aparece com a base que o gerou**. Um "58%" sozinho não deixa ninguém
 * desconfiar; "58% de 10.205 matrículas" num sistema com 785 alunos denuncia
 * sozinho o problema de dados que a migração ainda não fechou.
 */

const CORES = ['#0097B2', '#0CC0DF', '#FE9002', '#5CE1E6', '#063B49', '#7A5AF8'];

function pct(m: Medida): string {
  return m.pct === null ? '—' : `${m.pct}%`;
}

function baseDe(m: Medida, unidade: string): string {
  return m.base === 0 ? 'sem base para calcular' : `de ${m.base.toLocaleString('pt-BR')} ${unidade}`;
}

export default function AdminRetention() {
  const t = useT();
  const q = useRetencao();
  const rel = q.data;

  /** Recharts quer uma linha por semana com uma coluna por curso. */
  const dadosCoorte = useMemo(() => {
    if (!rel) return [];
    return rel.coorte.map((ponto) => {
      const linha: Record<string, string | number | null> = { semana: `S${ponto.semana}` };
      for (const c of rel.cursos) linha[c.id] = ponto.porCurso[c.id] ?? null;
      return linha;
    });
  }, [rel]);

  const cursosNaCoorte = useMemo(() => {
    if (!rel) return [];
    // Curso sem ninguém com idade suficiente não vira linha reta em zero: some.
    return rel.cursos.filter((c) => rel.coorte.some((p) => p.porCurso[c.id] !== null));
  }, [rel]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('admin.nav.retention')}</h1>
        <p className="pco-section-subtitle mt-1">
          Calculado sobre as matrículas registradas — cada percentual vem com a base que o gerou.
        </p>
      </header>

      {q.isLoading && <CardListSkeleton />}

      {q.isError && (
        <div className="pco-card border-status-danger/40 bg-status-danger/5 p-4">
          <p className="text-sm font-semibold text-status-danger">
            Não foi possível calcular a retenção.
          </p>
        </div>
      )}

      {rel && (
        <>
          <p className="text-xs text-ink-subtle">
            Base do cálculo: {rel.base.alunos.toLocaleString('pt-BR')} alunos,{' '}
            {rel.base.matriculas.toLocaleString('pt-BR')} matrículas em {rel.base.cursos}{' '}
            {rel.base.cursos === 1 ? 'curso' : 'cursos'}.
          </p>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<Users size={16} />}
              label="Ativos nos últimos 30d"
              value={pct(rel.kpis.ativosRecentes)}
              nota={`${baseDe(rel.kpis.ativosRecentes, 'alunos')} com 90+ dias de casa`}
              color="blue"
            />
            <Kpi
              icon={<TrendingUp size={16} />}
              label="Conclusão geral"
              value={pct(rel.kpis.conclusaoGeral)}
              nota={baseDe(rel.kpis.conclusaoGeral, 'matrículas')}
              color="green"
            />
            <Kpi
              icon={<Clock size={16} />}
              label="Horas assistidas"
              value={rel.kpis.horasAssistidas.horas.toLocaleString('pt-BR')}
              nota={
                rel.kpis.horasAssistidas.alunos === 0
                  ? 'nenhum aluno com tempo registrado'
                  : `por ${rel.kpis.horasAssistidas.alunos.toLocaleString('pt-BR')} alunos`
              }
              color="cyan"
            />
            <Kpi
              icon={<ArrowUpRight size={16} />}
              label="Impacto reengajamento"
              value={pct(rel.kpis.impactoReengajamento)}
              nota={baseDe(rel.kpis.impactoReengajamento, 'e-mails enviados')}
              color="orange"
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1">
                Curva de retenção por coorte
              </h3>
              <p className="text-xs text-ink-muted mb-3">
                % ainda ativo N semanas depois de se matricular. Cada semana só conta quem já se
                matriculou há esse tempo — senão quem entrou ontem apareceria como abandono.
              </p>
              {cursosNaCoorte.length === 0 ? (
                <SemDados texto="Nenhum curso tem matrículas antigas o bastante para uma curva." />
              ) : (
                <div className="h-64 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosCoorte}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
                      <XAxis dataKey="semana" stroke="#98A2B3" fontSize={11} />
                      <YAxis stroke="#98A2B3" fontSize={11} width={32} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #EEF5F7',
                          fontSize: 12,
                        }}
                        formatter={(v: number) => `${v}%`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {cursosNaCoorte.map((c, i) => (
                        <Line
                          key={c.id}
                          type="monotone"
                          dataKey={c.id}
                          name={c.nome}
                          stroke={CORES[i % CORES.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-1">
                Conclusão e risco por curso
              </h3>
              <p className="text-xs text-ink-muted mb-3">
                Conclusão = matrículas em 100%. Risco = alunos marcados pelo cálculo de evasão.
              </p>
              {rel.cursos.length === 0 ? (
                <SemDados texto="Nenhuma matrícula registrada." />
              ) : (
                <>
                  <div className="h-64 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rel.cursos.map((c) => ({
                          name: c.nome,
                          conclusao: c.conclusao.pct ?? 0,
                          emRisco: c.emRisco.pct ?? 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
                        <XAxis dataKey="name" stroke="#98A2B3" fontSize={11} />
                        <YAxis stroke="#98A2B3" fontSize={11} width={32} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #EEF5F7',
                            fontSize: 12,
                          }}
                          formatter={(v: number) => `${v}%`}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="conclusao"
                          name="Conclusão"
                          fill="#0097B2"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="emRisco"
                          name="Em risco"
                          fill="#FE9002"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1 text-[11px] text-ink-subtle">
                    {rel.cursos.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span className="truncate">{c.nome}</span>
                        <span className="shrink-0">
                          {c.matriculados.toLocaleString('pt-BR')} matrículas · progresso médio{' '}
                          {c.progressoMedio === null ? '—' : `${c.progressoMedio}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <section className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-1">
              Impacto do reengajamento
            </h3>
            <p className="text-xs text-ink-muted mb-3">
              Por semana de envio: quantos e-mails saíram e em quantos deles o aluno voltou a
              acessar antes do envio seguinte.
            </p>
            {rel.reengajamento.length === 0 ? (
              <SemDados texto="Nenhum e-mail de reengajamento enviado ainda — o gráfico aparece quando o worker rodar." />
            ) : (
              <div className="h-56 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rel.reengajamento}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F7" />
                    <XAxis
                      dataKey="semana"
                      stroke="#98A2B3"
                      fontSize={11}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis stroke="#98A2B3" fontSize={11} width={32} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #EEF5F7',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="enviados"
                      name="E-mails enviados"
                      fill="#5CE1E6"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="retomados"
                      name="Voltaram a acessar"
                      fill="#0097B2"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-1 flex items-center gap-2">
              <AlertTriangle size={16} className="text-pco-orange" strokeWidth={1.75} />
              O que esta tela não mede
            </h3>
            <p className="text-xs text-ink-muted mb-3">
              Declarado em vez de estimado — o gráfico que faltava era exatamente o que esta lista
              substituiu.
            </p>
            <ul className="space-y-2 text-sm">
              {rel.naoMedido.map((n) => (
                <li key={n.o_que} className="flex items-start gap-2 text-ink-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-pco-orange shrink-0" />
                  <span>
                    {n.o_que}
                    <span className="block text-[11px] text-ink-subtle">
                      por quê: {n.depende_de}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function SemDados({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl bg-surface-off p-6 text-center text-xs text-ink-subtle">{texto}</p>
  );
}

function Kpi({
  icon,
  label,
  value,
  nota,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** A base do cálculo. Sem ela, o percentual não deveria sair de casa. */
  nota: string;
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
      <div className="mt-2 text-xl font-bold tracking-tight text-pco-deep">{value}</div>
      <p className="mt-1 text-[10px] text-ink-subtle">{nota}</p>
    </div>
  );
}
