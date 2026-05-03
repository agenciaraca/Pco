import { useState } from 'react';
import {
  Bot,
  AlertCircle,
  Save,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import { aiConfigurations } from '../../data/seed';

const tabs = [
  { id: 'limites', label: 'Limites', icon: <Users size={14} strokeWidth={1.75} /> },
  { id: 'escopo', label: 'Escopo e mensagens', icon: <AlertCircle size={14} strokeWidth={1.75} /> },
  { id: 'auditoria', label: 'Auditoria', icon: <TrendingUp size={14} strokeWidth={1.75} /> },
];

const recentLogs = [
  { student: 'Carla M.', tokens: 320, success: true, time: 'há 12 min' },
  { student: 'Diego R.', tokens: 510, success: true, time: 'há 38 min' },
  { student: 'Renata B.', tokens: 200, success: false, time: 'há 1h' },
  { student: 'Pedro O.', tokens: 380, success: true, time: 'há 2h' },
  { student: 'Beatriz L.', tokens: 670, success: true, time: 'há 3h' },
];

export default function AdminTutor() {
  const [active, setActive] = useState('limites');
  const config = aiConfigurations.find((c) => c.module === 'tutor') ?? aiConfigurations[0];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Tutor Virtual — Configurações</h1>
          <p className="pco-section-subtitle mt-1">
            Limites por aluno, escopo, mensagens fora do contexto e auditoria.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Save size={12} strokeWidth={2} />
          Salvar configurações
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat icon={<Bot size={16} className="text-pco-blue" />} label="Perguntas hoje" value="247" />
        <Stat
          icon={<Users size={16} className="text-pco-cyan" />}
          label="Alunos ativos no Tutor"
          value="89"
        />
        <Stat
          icon={<TrendingUp size={16} className="text-status-success" />}
          label="Taxa de sucesso"
          value="94%"
          accent="green"
        />
        <Stat
          icon={<AlertCircle size={16} className="text-pco-orange" />}
          label="Limite atingido (mês)"
          value="3"
          accent="orange"
        />
      </div>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3">
        <Bot className="text-pco-blue shrink-0" size={18} strokeWidth={1.75} />
        <div className="text-xs text-ink-muted">
          <p className="text-pco-deep font-semibold mb-1">Provedor configurado em "Gestão de IAs"</p>
          <p>
            Modelo atual: <span className="font-mono text-pco-deep">{config.model}</span> · Provedor{' '}
            <span className="font-semibold text-pco-deep capitalize">{config.provider}</span> · Configurações
            de provedor, modelo e chave API são feitas em <a href="/admin/ias" className="text-pco-blue hover:underline">/admin/ias</a>.
          </p>
        </div>
      </div>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'limites' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Limites por aluno</h3>
            <Field label="Limite gratuito de perguntas/mês">
              <input type="number" className="pco-input" defaultValue={config.perStudentLimit} />
            </Field>
            <Field label="Limite por dia">
              <input type="number" className="pco-input" defaultValue={10} />
            </Field>
            <Field label="Tempo entre perguntas (segundos)">
              <input type="number" className="pco-input" defaultValue={3} />
            </Field>
          </div>

          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Limites globais</h3>
            <Field label="Limite global por dia">
              <input type="number" className="pco-input" defaultValue={config.perDayLimit} />
            </Field>
            <Field label="Limite global por mês">
              <input type="number" className="pco-input" defaultValue={config.perMonthLimit} />
            </Field>
            <Field label="Custo máximo mensal (R$)">
              <input type="number" className="pco-input" defaultValue={config.monthlyCostCap} />
            </Field>
          </div>

          <div className="pco-card lg:col-span-2 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Pacotes adicionais (mock)</h3>
            <p className="text-xs text-ink-muted">
              Após atingir o limite gratuito, alunos podem comprar pacotes adicionais via sistema externo.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <PackageCard label="Pacote 30" perguntas={30} preco={29} />
              <PackageCard label="Pacote 100" perguntas={100} preco={79} popular />
              <PackageCard label="Pacote 300" perguntas={300} preco={199} />
            </div>
          </div>
        </div>
      )}

      {active === 'escopo' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Mensagem de sistema</h3>
            <p className="text-xs text-ink-muted">
              Instrução fixa enviada ao modelo a cada conversa.
            </p>
            <textarea
              className="pco-input resize-none text-xs font-mono"
              rows={6}
              defaultValue={config.systemMessage}
            />
          </div>

          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Resposta fora do escopo</h3>
            <p className="text-xs text-ink-muted">
              Mensagem padrão quando o Tutor identifica pergunta fora do contexto pedagógico.
            </p>
            <textarea
              className="pco-input resize-none text-sm"
              rows={4}
              defaultValue={config.fallbackResponse}
            />
          </div>

          <div className="pco-card space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Tópicos bloqueados</h3>
            <div className="flex flex-wrap gap-1">
              {config.blockedTopics.map((t) => (
                <span key={t} className="pco-badge bg-status-danger/10 text-status-danger">
                  {t}
                </span>
              ))}
            </div>
            <button className="pco-btn-secondary text-xs">+ Adicionar tópico</button>
          </div>

          <div className="pco-card space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Escopo permitido</h3>
            <div className="flex flex-wrap gap-1">
              {config.allowedScopes.map((t) => (
                <span key={t} className="pco-badge bg-status-success/10 text-status-success">
                  {t}
                </span>
              ))}
            </div>
            <button className="pco-btn-secondary text-xs">+ Adicionar escopo</button>
          </div>

          <div className="pco-card lg:col-span-2 border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
            <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-pco-deep">Aviso obrigatório exibido ao aluno:</span>{' '}
              "O Tutor Virtual responde apenas dúvidas pedagógicas relacionadas aos cursos da PCO. Ele
              não substitui professores, supervisão clínica, atendimento psicológico, médico ou
              jurídico."
            </p>
          </div>
        </div>
      )}

      {active === 'auditoria' && (
        <div className="space-y-4">
          <div className="pco-card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-gray flex items-center justify-between">
              <h3 className="text-sm font-semibold text-pco-deep">Logs recentes</h3>
              <button className="pco-btn-ghost text-xs">
                <RefreshCw size={12} strokeWidth={2} />
                Atualizar
              </button>
            </div>
            <ul className="divide-y divide-surface-gray">
              {recentLogs.map((l, i) => (
                <li key={i} className="flex items-center gap-3 p-3 hover:bg-surface-off">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      l.success ? 'bg-status-success' : 'bg-status-danger'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep">{l.student}</div>
                    <div className="text-[11px] text-ink-subtle">{l.tokens} tokens · {l.time}</div>
                  </div>
                  <span
                    className={`pco-badge ${
                      l.success
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-status-danger/15 text-status-danger'
                    }`}
                  >
                    {l.success ? 'Sucesso' : 'Falha'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card label="Tokens de entrada" value="284k" sub="último mês" />
            <Card label="Tokens de saída" value="312k" sub="último mês" />
            <Card label="Custo estimado" value="R$ 642" sub="vs R$ 800 cap" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'green' | 'orange';
}) {
  return (
    <div className="pco-card">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
          {label}
        </div>
        <div className="h-8 w-8 rounded-lg bg-surface-off grid place-items-center">{icon}</div>
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${
          accent === 'green'
            ? 'text-status-success'
            : accent === 'orange'
              ? 'text-pco-orange'
              : 'text-pco-deep'
        }`}
      >
        {value}
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

function PackageCard({
  label,
  perguntas,
  preco,
  popular,
}: {
  label: string;
  perguntas: number;
  preco: number;
  popular?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${popular ? 'border-pco-blue bg-pco-blue/5' : 'border-surface-gray bg-surface-off'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-pco-deep">{label}</div>
        {popular && <span className="pco-badge bg-pco-blue text-white">Popular</span>}
      </div>
      <div className="text-2xl font-bold text-pco-deep">{perguntas}</div>
      <div className="text-[11px] text-ink-subtle">perguntas adicionais</div>
      <div className="mt-3 text-base font-semibold text-pco-deep">R$ {preco}</div>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
      <div className="text-[11px] text-ink-subtle">{sub}</div>
    </div>
  );
}
