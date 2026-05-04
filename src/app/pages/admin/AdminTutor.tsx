import { useState, useEffect } from 'react';
import {
  Bot,
  AlertCircle,
  Save,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Tabs from '../../components/Tabs';
import {
  useAiConfigurations,
  useUpdateAiConfiguration,
  useTutorUsageStats,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../components/Toast';

const tabs = [
  { id: 'limites', label: 'Limites', icon: <Users size={14} strokeWidth={1.75} /> },
  { id: 'escopo', label: 'Escopo e mensagens', icon: <AlertCircle size={14} strokeWidth={1.75} /> },
  { id: 'uso', label: 'Uso (30d)', icon: <TrendingUp size={14} strokeWidth={1.75} /> },
];

export default function AdminTutor() {
  const [active, setActive] = useState('limites');
  const configsQ = useAiConfigurations();
  const updateMut = useUpdateAiConfiguration();
  const toast = useToast();

  const config = configsQ.data?.find((c) => c.module === 'tutor');

  const [perStudentLimit, setPerStudentLimit] = useState(0);
  const [perDayLimit, setPerDayLimit] = useState(0);
  const [perMonthLimit, setPerMonthLimit] = useState(0);
  const [monthlyCostCap, setMonthlyCostCap] = useState(0);
  const [systemMessage, setSystemMessage] = useState('');
  const [fallbackResponse, setFallbackResponse] = useState('');
  const [blockedTopicsRaw, setBlockedTopicsRaw] = useState('');
  const [allowedScopesRaw, setAllowedScopesRaw] = useState('');

  useEffect(() => {
    if (!config) return;
    setPerStudentLimit(config.perStudentLimit ?? 0);
    setPerDayLimit(config.perDayLimit ?? 0);
    setPerMonthLimit(config.perMonthLimit ?? 0);
    setMonthlyCostCap(config.monthlyCostCap ?? 0);
    setSystemMessage(config.systemMessage ?? '');
    setFallbackResponse(config.fallbackResponse ?? '');
    setBlockedTopicsRaw((config.blockedTopics ?? []).join(', '));
    setAllowedScopesRaw((config.allowedScopes ?? []).join(', '));
  }, [config]);

  if (configsQ.isLoading || !config) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="pco-section-title">Tutor Virtual — Configurações</h1>
          <p className="pco-section-subtitle mt-1">Carregando...</p>
        </header>
        <CardListSkeleton count={2} />
      </div>
    );
  }

  function parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    if (!config) return;
    try {
      await updateMut.mutateAsync({
        id: config.id,
        patch: {
          perStudentLimit,
          perDayLimit,
          perMonthLimit,
          monthlyCostCap,
          systemMessage,
          fallbackResponse,
          blockedTopics: parseTags(blockedTopicsRaw),
          allowedScopes: parseTags(allowedScopesRaw),
        },
      });
      toast.success('Configurações salvas');
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Tutor Virtual — Configurações</h1>
          <p className="pco-section-subtitle mt-1">
            Limites por aluno, escopo, mensagens fora do contexto.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMut.isPending}
          className="pco-btn-primary text-xs"
        >
          <Save size={12} strokeWidth={2} />
          {updateMut.isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </header>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3">
        <Bot className="text-pco-blue shrink-0" size={18} strokeWidth={1.75} />
        <div className="text-xs text-ink-muted">
          <p className="text-pco-deep font-semibold mb-1">
            Provedor configurado em "Gestão de IAs"
          </p>
          <p>
            Modelo atual: <span className="font-mono text-pco-deep">{config.model}</span> ·
            Provedor{' '}
            <span className="font-semibold text-pco-deep capitalize">{config.provider}</span> ·
            Configurações de provedor, modelo e chave API são feitas em{' '}
            <Link to="/admin/ias" className="text-pco-blue hover:underline">
              /admin/ias
            </Link>
            .
          </p>
        </div>
      </div>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'limites' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card p-6 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Limites por aluno</h3>
            <Field label="Limite gratuito de perguntas/mês">
              <input
                type="number"
                min={0}
                className="pco-input"
                value={perStudentLimit}
                onChange={(e) => setPerStudentLimit(Number(e.target.value))}
              />
            </Field>
            <Field label="Custo máximo mensal global (R$)">
              <input
                type="number"
                min={0}
                className="pco-input"
                value={monthlyCostCap}
                onChange={(e) => setMonthlyCostCap(Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="pco-card p-6 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Limites globais</h3>
            <Field label="Limite global por dia">
              <input
                type="number"
                min={0}
                className="pco-input"
                value={perDayLimit}
                onChange={(e) => setPerDayLimit(Number(e.target.value))}
              />
            </Field>
            <Field label="Limite global por mês">
              <input
                type="number"
                min={0}
                className="pco-input"
                value={perMonthLimit}
                onChange={(e) => setPerMonthLimit(Number(e.target.value))}
              />
            </Field>
          </div>
        </div>
      )}

      {active === 'escopo' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card p-6 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Mensagem de sistema</h3>
            <p className="text-xs text-ink-muted">
              Instrução fixa enviada ao modelo a cada conversa.
            </p>
            <textarea
              className="pco-input resize-none text-xs font-mono"
              rows={6}
              value={systemMessage}
              onChange={(e) => setSystemMessage(e.target.value)}
            />
          </div>

          <div className="pco-card p-6 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Resposta fora do escopo</h3>
            <p className="text-xs text-ink-muted">
              Mensagem padrão quando o Tutor identifica pergunta fora do contexto pedagógico.
            </p>
            <textarea
              className="pco-input resize-none text-sm"
              rows={4}
              value={fallbackResponse}
              onChange={(e) => setFallbackResponse(e.target.value)}
            />
          </div>

          <div className="pco-card p-6 space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Tópicos bloqueados</h3>
            <p className="text-xs text-ink-muted">Separados por vírgula.</p>
            <textarea
              className="pco-input resize-none text-sm"
              rows={3}
              value={blockedTopicsRaw}
              onChange={(e) => setBlockedTopicsRaw(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {parseTags(blockedTopicsRaw).map((t) => (
                <span key={t} className="pco-badge bg-status-danger/10 text-status-danger">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="pco-card p-6 space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Escopo permitido</h3>
            <p className="text-xs text-ink-muted">Separados por vírgula.</p>
            <textarea
              className="pco-input resize-none text-sm"
              rows={3}
              value={allowedScopesRaw}
              onChange={(e) => setAllowedScopesRaw(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {parseTags(allowedScopesRaw).map((t) => (
                <span key={t} className="pco-badge bg-status-success/10 text-status-success">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="pco-card lg:col-span-2 border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
            <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-pco-deep">
                Aviso obrigatório exibido ao aluno:
              </span>{' '}
              "O Tutor Virtual responde apenas dúvidas pedagógicas relacionadas aos cursos da
              PCO. Ele não substitui professores, supervisão clínica, atendimento psicológico,
              médico ou jurídico."
            </p>
          </div>
        </div>
      )}

      {active === 'uso' && <UsoPane />}
    </div>
  );
}

function UsoPane() {
  const { data, isLoading } = useTutorUsageStats(30);
  if (isLoading || !data) {
    return <div className="pco-card p-6 text-sm text-ink-muted">Carregando...</div>;
  }
  const max = Math.max(1, ...data.byDay.map((d) => d.count));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Perguntas</div>
          <div className="mt-1 text-2xl font-bold text-pco-deep">{data.totalTurns}</div>
          <div className="text-[11px] text-ink-subtle">últimos {data.days} dias</div>
        </div>
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Alunos únicos</div>
          <div className="mt-1 text-2xl font-bold text-pco-deep">{data.uniqueUsers}</div>
          <div className="text-[11px] text-ink-subtle">interagiram com o Tutor</div>
        </div>
        <div className="pco-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">Média/aluno</div>
          <div className="mt-1 text-2xl font-bold text-pco-deep">
            {data.uniqueUsers > 0 ? (data.totalTurns / data.uniqueUsers).toFixed(1) : 0}
          </div>
          <div className="text-[11px] text-ink-subtle">perguntas/aluno</div>
        </div>
      </div>

      <div className="pco-card p-4">
        <h3 className="text-sm font-semibold text-pco-deep mb-3">Por dia (últimos 30)</h3>
        <div className="flex items-end gap-1 h-24">
          {data.byDay.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.count}`}
              className="flex-1 bg-pco-blue/30 hover:bg-pco-blue/50 rounded-sm"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: '2px' }}
            />
          ))}
        </div>
      </div>

      <div className="pco-card p-4">
        <h3 className="text-sm font-semibold text-pco-deep mb-3">Top usuários</h3>
        {data.topUsers.length === 0 ? (
          <p className="text-xs text-ink-muted">Sem perguntas no período.</p>
        ) : (
          <ul className="divide-y divide-surface-mute">
            {data.topUsers.map((u, i) => (
              <li key={u.userId} className="py-2 flex items-center gap-3">
                <span className="text-xs text-ink-subtle w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep truncate">
                    {u.name ?? u.email ?? u.userId}
                  </div>
                  {u.email && (
                    <div className="text-[11px] text-ink-subtle truncate">{u.email}</div>
                  )}
                </div>
                <div className="text-sm font-bold text-pco-blue">{u.count}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
    </label>
  );
}

