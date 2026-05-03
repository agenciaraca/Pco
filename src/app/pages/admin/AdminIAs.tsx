import { Brain, Power } from 'lucide-react';
import { aiConfigurations } from '../../data/seed';

const moduleLabels: Record<string, string> = {
  tutor: 'Tutor Virtual',
  recovery_plan: 'Plano de Retomada',
  evasion: 'Previsão de Evasão',
  recommendations: 'Recomendações',
  support: 'Suporte assistido',
  summaries: 'Resumos & Materiais',
};

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic / Claude',
  google: 'Google Gemini',
  meta: 'Meta / Llama',
  mistral: 'Mistral AI',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  xai: 'xAI / Grok',
  perplexity: 'Perplexity',
  azure_openai: 'Azure OpenAI',
  bedrock: 'AWS Bedrock',
  openrouter: 'OpenRouter',
  custom: 'Custom API',
};

export default function AdminIAs() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Gestão de IAs</h1>
        <p className="pco-section-subtitle mt-1">
          Provedores, modelos, limites, escopos e auditoria das IAs do AVA.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {aiConfigurations.map((c) => (
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
                    {providerLabels[c.provider]}
                  </h3>
                  <div className="text-[11px] text-ink-subtle font-mono mt-0.5">{c.model}</div>
                </div>
              </div>
              <span
                className={`pco-badge ${
                  c.active
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                <Power size={10} strokeWidth={2} />
                {c.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

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
              <code className="block text-xs font-mono px-3 py-2 rounded-lg bg-surface-off text-ink-muted">
                {c.apiKeyMasked}
              </code>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-ink-subtle mb-1">
                Bloqueios de escopo
              </div>
              <div className="flex flex-wrap gap-1">
                {c.blockedTopics.map((t) => (
                  <span key={t} className="pco-badge bg-status-danger/10 text-status-danger">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="pco-btn-secondary text-xs flex-1 justify-center">Editar</button>
              <button className="pco-btn-ghost text-xs">Ver auditoria</button>
            </div>
          </div>
        ))}
      </div>
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
