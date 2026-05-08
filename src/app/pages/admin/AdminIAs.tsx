import { useState } from 'react';
import {
  Brain,
  Power,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  useAiConfigurations,
  useAiProviders,
  useUpdateAiConfiguration,
  useTestAiConnection,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import type { AiConfigPublic, AiProviderInfo } from '../../data/api';
import { useT } from '../../i18n';

const moduleLabels: Record<string, string> = {
  tutor: 'Tutor Virtual',
  recovery_plan: 'Plano de Retomada',
  evasion: 'Previsão de Evasão',
  recommendations: 'Recomendações',
  support: 'Suporte assistido',
  summaries: 'Resumos & Materiais',
};

const moduleDescriptions: Record<string, string> = {
  tutor: 'IA que responde dúvidas pedagógicas dos alunos sobre os cursos.',
  recovery_plan: 'Gera planos de retomada para alunos em risco de evasão.',
  evasion: 'Calcula score e motivos de risco de evasão por aluno.',
  recommendations: 'Sugere conteúdo personalizado dentro do AVA.',
  support: 'Assistente de suporte de primeiro atendimento.',
  summaries: 'Resumos automáticos de aulas e materiais longos.',
};

export default function AdminIAs() {
  const t = useT();
  const configsQ = useAiConfigurations();
  const providersQ = useAiProviders();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingConfig = editingId
    ? configsQ.data?.find((c) => c.id === editingId)
    : null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.aiManagement')}</h1>
          <p className="pco-section-subtitle mt-1">
            Configure provedor, modelo, chave de API e limites para cada módulo de IA do AVA.
          </p>
        </div>
      </header>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3">
        <Sparkles className="text-pco-blue shrink-0" size={18} strokeWidth={1.75} />
        <div className="text-xs text-ink-muted">
          <p className="text-pco-deep font-semibold mb-1">
            Chaves de API ficam no servidor
          </p>
          <p>
            As chaves de API são armazenadas e usadas exclusivamente no servidor. O cliente
            recebe apenas a versão mascarada. Quando integrarmos o banco de dados, elas serão
            criptografadas em repouso.
          </p>
        </div>
      </div>

      {configsQ.isLoading && <CardListSkeleton count={2} />}
      {configsQ.isError && (
        <div className="pco-card">
          <ErrorState
            title="Falha ao carregar configurações"
            action={
              <button onClick={() => configsQ.refetch()} className="pco-btn-primary text-xs">
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {configsQ.data && configsQ.data.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Nenhuma configuração de IA"
            description="Configurações iniciais devem ser semeadas pelo backend."
          />
        </div>
      )}

      {configsQ.data && configsQ.data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {configsQ.data.map((c) => {
            const provider = providersQ.data?.find((p) => p.id === c.provider);
            return (
              <div key={c.id} className="pco-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center">
                      <Brain size={18} className="text-pco-blue" strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                        {moduleLabels[c.module]}
                      </div>
                      <h3 className="text-base font-semibold text-pco-deep">
                        {provider?.name ?? c.provider}
                      </h3>
                      <div className="text-[11px] text-ink-subtle font-mono mt-0.5">
                        {c.model}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`pco-badge ${
                      c.active && c.apiKeyConfigured
                        ? 'bg-status-success/10 text-status-success'
                        : c.active && !c.apiKeyConfigured
                          ? 'bg-pco-orange/10 text-pco-orange'
                          : 'bg-surface-gray text-ink-muted'
                    }`}
                  >
                    <Power size={10} strokeWidth={2} />
                    {c.active && c.apiKeyConfigured
                      ? 'Ativo'
                      : c.active && !c.apiKeyConfigured
                        ? 'Sem chave'
                        : 'Inativo'}
                  </span>
                </div>

                <p className="mt-3 text-xs text-ink-muted line-clamp-2">
                  {moduleDescriptions[c.module]}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Box label="Temperatura" value={String(c.temperature)} />
                  <Box label="Max tokens" value={c.maxTokens.toLocaleString('pt-BR')} />
                  <Box label="Limite/aluno" value={c.perStudentLimit.toString()} />
                  <Box label="Custo máx mensal" value={`R$ ${c.monthlyCostCap}`} />
                </div>

                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-wider text-ink-subtle mb-1">
                    Chave API
                  </div>
                  <code
                    className={`block text-xs font-mono px-3 py-2 rounded-lg ${
                      c.apiKeyConfigured
                        ? 'bg-surface-off text-ink-muted'
                        : 'bg-pco-orange/10 text-pco-orange'
                    }`}
                  >
                    {c.apiKeyConfigured ? c.apiKeyMasked : 'Não configurada'}
                  </code>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setEditingId(c.id)}
                    className="pco-btn-primary text-xs flex-1 justify-center"
                  >
                    <Edit3 size={12} strokeWidth={1.75} />
                    Configurar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingConfig && providersQ.data && (
        <ConfigEditor
          config={editingConfig}
          providers={providersQ.data}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

interface ConfigEditorProps {
  config: AiConfigPublic;
  providers: AiProviderInfo[];
  onClose: () => void;
}

function ConfigEditor({ config, providers, onClose }: ConfigEditorProps) {
  const toast = useToast();
  const update = useUpdateAiConfiguration();
  const test = useTestAiConnection();

  const [provider, setProvider] = useState<AiProviderInfo['id']>(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens);
  const [perStudentLimit, setPerStudentLimit] = useState(config.perStudentLimit);
  const [monthlyCostCap, setMonthlyCostCap] = useState(config.monthlyCostCap);
  const [systemMessage, setSystemMessage] = useState(config.systemMessage);
  const [active, setActive] = useState(config.active);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const currentProvider = providers.find((p) => p.id === provider);

  // Quando muda o provider, reseta o model para o default dele
  const handleProviderChange = (next: AiProviderInfo['id']) => {
    setProvider(next);
    const defaultModel = providers.find((p) => p.id === next)?.defaultModel;
    if (defaultModel) setModel(defaultModel);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!apiKey) {
      toast.warning('Insira a chave', 'Cole a chave de API no campo antes de testar.');
      return;
    }
    try {
      const result = await test.mutateAsync({ provider, apiKey });
      setTestResult(result);
      if (result.ok) toast.success('Chave válida', 'O provider respondeu com sucesso.');
      else toast.error('Falha no teste', result.error);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setTestResult({ ok: false, error: msg });
      toast.error('Falha no teste', msg);
    }
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: config.id,
        patch: {
          provider,
          model,
          apiKey: apiKey || undefined,
          temperature,
          maxTokens,
          perStudentLimit,
          monthlyCostCap,
          systemMessage,
          active,
        },
      });
      toast.success('Configuração salva', 'As mudanças entram em efeito imediatamente.');
      onClose();
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Configuração
            </div>
            <h2 className="text-lg font-bold text-pco-deep">{moduleLabels[config.module]}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <Field label="Provider">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    provider === p.id
                      ? 'border-pco-blue bg-pco-blue/5'
                      : 'border-surface-gray hover:border-pco-blue/40 hover:bg-surface-off'
                  }`}
                >
                  <div className="text-sm font-semibold text-pco-deep">{p.name}</div>
                  <div className="text-[10px] text-ink-subtle uppercase tracking-wider">
                    {p.id}
                  </div>
                </button>
              ))}
            </div>
            {currentProvider && (
              <a
                href={currentProvider.consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-pco-blue hover:underline"
              >
                Console do provider
                <ExternalLink size={10} strokeWidth={2} />
              </a>
            )}
          </Field>

          <Field label="Modelo">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="pco-input"
            >
              {currentProvider?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.inputCostPerMTok !== undefined &&
                    ` — $${m.inputCostPerMTok}/$${m.outputCostPerMTok}/MTok`}
                </option>
              ))}
            </select>
            {currentProvider?.models.find((m) => m.id === model)?.recommendedFor && (
              <p className="mt-1 text-[11px] text-ink-subtle">
                {currentProvider.models.find((m) => m.id === model)?.recommendedFor}
              </p>
            )}
          </Field>

          <Field label="Chave de API">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={
                  config.apiKeyConfigured
                    ? `Atual: ${config.apiKeyMasked} — deixe vazio para manter`
                    : 'Cole a chave do provider aqui'
                }
                className="pco-input pr-11 font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-ink-subtle hover:text-pco-blue rounded-lg hover:bg-surface-gray"
                aria-label={showKey ? 'Ocultar' : 'Mostrar'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleTest}
                disabled={!apiKey || test.isPending}
                className="pco-btn-secondary text-xs"
              >
                {test.isPending ? (
                  <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={12} strokeWidth={2} />
                )}
                Testar conexão
              </button>
              {testResult?.ok && (
                <span className="inline-flex items-center gap-1 text-xs text-status-success">
                  <CheckCircle2 size={12} strokeWidth={2} />
                  Provider respondeu
                </span>
              )}
              {testResult && !testResult.ok && (
                <span className="inline-flex items-center gap-1 text-xs text-status-danger">
                  <AlertCircle size={12} strokeWidth={2} />
                  {testResult.error}
                </span>
              )}
              {currentProvider && (
                <a
                  href={currentProvider.apiKeyDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-pco-blue hover:underline ml-auto"
                >
                  Onde encontro a chave?
                </a>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Temperatura">
              <input
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="pco-input"
              />
            </Field>
            <Field label="Max tokens">
              <input
                type="number"
                min={1}
                max={32000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="pco-input"
              />
            </Field>
            <Field label="Limite por aluno (mês)">
              <input
                type="number"
                min={0}
                value={perStudentLimit}
                onChange={(e) => setPerStudentLimit(Number(e.target.value))}
                className="pco-input"
              />
            </Field>
            <Field label="Custo máx. mensal (R$)">
              <input
                type="number"
                min={0}
                value={monthlyCostCap}
                onChange={(e) => setMonthlyCostCap(Number(e.target.value))}
                className="pco-input"
              />
            </Field>
          </div>

          <Field label="Mensagem de sistema (instruções fixas para a IA)">
            <textarea
              value={systemMessage}
              onChange={(e) => setSystemMessage(e.target.value)}
              rows={6}
              className="pco-input resize-none text-xs font-mono leading-relaxed"
            />
          </Field>

          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
            />
            <span className="text-sm text-pco-deep font-medium">
              Ativo (IA disponível para uso)
            </span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-surface-gray px-6 py-4 flex items-center justify-end gap-2 rounded-b-2xl">
          <button onClick={onClose} className="pco-btn-ghost text-xs">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="pco-btn-primary text-xs"
          >
            {update.isPending ? (
              <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            ) : (
              <Save size={12} strokeWidth={2} />
            )}
            Salvar configuração
          </button>
        </div>
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

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-off p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-sm font-semibold text-pco-deep">{value}</div>
    </div>
  );
}
