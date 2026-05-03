import { useState, useEffect } from 'react';
import {
  Bot,
  AlertCircle,
  Save,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Tabs from '../../components/Tabs';
import { useAiConfigurations, useUpdateAiConfiguration } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../components/Toast';

const tabs = [
  { id: 'limites', label: 'Limites', icon: <Users size={14} strokeWidth={1.75} /> },
  { id: 'escopo', label: 'Escopo e mensagens', icon: <AlertCircle size={14} strokeWidth={1.75} /> },
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

