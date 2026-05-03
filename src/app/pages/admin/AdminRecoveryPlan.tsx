import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Copy,
  Save,
  RefreshCw,
  AlertTriangle,
  Bot,
  Mic2,
  BookOpen,
  History,
  ArrowLeft,
} from 'lucide-react';
import { adminStudents, retentionRisks, courses } from '../../data/seed';

const initialMessage = `Oi, Carla. Como você está?

Notamos que faz alguns dias que você não acessa o AVA — e queremos te lembrar que sua jornada está te esperando, no seu ritmo.

Você está em Psicanálise Clínica, no Módulo 2. Que tal tentar uma aula curta hoje? Selecionei algumas coisas que podem te ajudar a retomar com leveza:

• Aula 3 do Módulo 2 (22 min)
• PCO POD: "O ato analítico além da técnica" (42 min)
• Pergunta sugerida ao Tutor: "Qual a diferença entre escuta e técnica?"

Se algo está difícil agora, só responder esta mensagem que falamos com você. Estamos aqui para apoiar.

Equipe pedagógica PCO`;

export default function AdminRecoveryPlan() {
  const student = adminStudents.find((s) => s.id === 's-101') ?? adminStudents[0];
  const risk = retentionRisks.find((r) => r.studentId === student.id);
  const [tone, setTone] = useState('acolhedor');
  const [channel, setChannel] = useState('in_app');
  const [intensity, setIntensity] = useState('media');
  const [goal, setGoal] = useState('retomar_modulo');
  const [includeTutor, setIncludeTutor] = useState(true);
  const [includePod, setIncludePod] = useState(true);
  const [includeLibrary, setIncludeLibrary] = useState(true);
  const [generated, setGenerated] = useState<string>(initialMessage);
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerated(initialMessage);
      setGenerating(false);
    }, 900);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/evasao"
          className="text-xs font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar à previsão de evasão
        </Link>
      </div>

      <header>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-pco-blue mb-2">
          <Sparkles size={14} strokeWidth={2} />
          Plano de retomada com IA
        </div>
        <h1 className="pco-section-title">Plano de Retomada — {student.name}</h1>
        <p className="pco-section-subtitle mt-1">
          A IA sugere. A decisão final é da equipe pedagógica.
        </p>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertTriangle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">
          Revise o plano antes de enviar ao aluno. Ajuste tom e conteúdo conforme o contexto
          pedagógico — o sistema apenas sugere uma estrutura inicial.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">Dados do aluno</h3>
          <div className="space-y-1.5 text-sm">
            <Row label="Nome" value={student.name} />
            <Row label="E-mail" value={student.email} mono />
            <Row label="Cursos" value={student.enrolledCourseIds.length} />
            <Row label="Último acesso" value={new Date(student.lastAccessAt).toLocaleDateString('pt-BR')} />
          </div>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">Score de evasão</h3>
          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-bold text-pco-deep">{student.riskScore}</div>
            <span
              className={`pco-badge ${
                student.riskScore >= 75
                  ? 'bg-status-danger/15 text-status-danger'
                  : student.riskScore >= 55
                    ? 'bg-pco-orange/15 text-pco-orange'
                    : 'bg-pco-blue/10 text-pco-blue'
              }`}
            >
              {student.riskScore >= 75 ? 'Crítico' : student.riskScore >= 55 ? 'Alto' : 'Médio'}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-surface-gray overflow-hidden">
            <div
              className="h-full rounded-full bg-status-danger"
              style={{ width: `${student.riskScore}%` }}
            />
          </div>
          {risk && (
            <div className="mt-3 flex flex-wrap gap-1">
              {risk.reasons.slice(0, 3).map((r) => (
                <span key={r} className="pco-badge bg-surface-gray text-ink-muted">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
            <Bot size={16} className="text-pco-blue" strokeWidth={1.75} />
            Diagnóstico da IA
          </h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            Aluno com sinal de afastamento progressivo (3 semanas sem acesso). Avaliação do
            Módulo 2 pendente. Tutor não foi utilizado. Padrão sugere bloqueio por
            sobrecarga ou desmotivação inicial — abordagem leve, foco em microvitória.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1 pco-card space-y-4">
          <h3 className="text-base font-semibold text-pco-deep">Configuração do plano</h3>

          <Field label="Tom da mensagem">
            <select className="pco-input" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="acolhedor">Acolhedor</option>
              <option value="direto">Direto</option>
              <option value="motivacional">Motivacional</option>
            </select>
          </Field>

          <Field label="Canal">
            <select className="pco-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="in_app">In-app</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>

          <Field label="Intensidade">
            <select
              className="pco-input"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
            >
              <option value="leve">Leve</option>
              <option value="media">Média</option>
              <option value="intensa">Intensa</option>
            </select>
          </Field>

          <Field label="Objetivo">
            <select className="pco-input" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="retomar_modulo">Retomar módulo atual</option>
              <option value="finalizar_avaliacao">Finalizar avaliação</option>
              <option value="reativar_geral">Reativação geral</option>
              <option value="apoio_emocional">Apoio emocional</option>
            </select>
          </Field>

          <div>
            <div className="text-xs font-medium text-ink-muted mb-2">Recursos sugeridos</div>
            <div className="space-y-2">
              <Toggle
                icon={<Bot size={14} className="text-pco-blue" />}
                label="Incluir Tutor Virtual"
                checked={includeTutor}
                onChange={setIncludeTutor}
              />
              <Toggle
                icon={<Mic2 size={14} className="text-pco-cyan" />}
                label="Incluir PCO POD"
                checked={includePod}
                onChange={setIncludePod}
              />
              <Toggle
                icon={<BookOpen size={14} className="text-pco-deep" />}
                label="Incluir Biblioteca"
                checked={includeLibrary}
                onChange={setIncludeLibrary}
              />
            </div>
          </div>

          <button onClick={generate} disabled={generating} className="pco-btn-primary w-full justify-center text-xs">
            {generating ? (
              <>
                <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles size={12} strokeWidth={2} />
                Gerar plano com IA
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-2">Plano sugerido</h3>
            <div className="grid sm:grid-cols-3 gap-2 mb-4 text-xs">
              <Tile label="Aula" value="Módulo 2 · Aula 3" />
              <Tile label="POD" value="O ato analítico" />
              <Tile label="Material" value="Cadernos PCO" />
              <Tile label="Pergunta ao Tutor" value="Diferença entre escuta e técnica" />
              <Tile label="Meta 7 dias" value="120 min" />
              <Tile label="Acompanhamento" value="In-app · Após 5d" />
            </div>
          </div>

          <div className="pco-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-pco-deep">Editor humano</h3>
              <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                Revise antes de enviar
              </span>
            </div>
            <textarea
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              rows={14}
              className="pco-input font-mono text-xs leading-relaxed"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="pco-btn-primary text-xs">
                <Send size={12} strokeWidth={2} />
                Enviar ao aluno
              </button>
              <button className="pco-btn-secondary text-xs">
                <Save size={12} strokeWidth={2} />
                Salvar plano
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(generated)}
                className="pco-btn-ghost text-xs"
              >
                <Copy size={12} strokeWidth={2} />
                Copiar mensagem
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
          <History size={16} className="text-ink-muted" strokeWidth={1.75} />
          Histórico de planos enviados
        </h3>
        <ul className="divide-y divide-surface-gray">
          <HistoryItem
            date="2026-04-28"
            channel="in_app"
            tone="acolhedor"
            outcome="Aluno respondeu, retomou módulo após 3 dias."
          />
          <HistoryItem
            date="2026-04-10"
            channel="email"
            tone="direto"
            outcome="Sem resposta. Tentativa anterior."
          />
        </ul>
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

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-semibold text-pco-deep ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Toggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
      {icon}
      <span className="text-sm text-pco-deep flex-1">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
      />
    </label>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-off p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-sm font-semibold text-pco-deep">{value}</div>
    </div>
  );
}

function HistoryItem({
  date,
  channel,
  tone,
  outcome,
}: {
  date: string;
  channel: string;
  tone: string;
  outcome: string;
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between text-xs text-ink-subtle mb-1">
        <div className="flex gap-2">
          <span className="pco-badge bg-pco-blue/10 text-pco-blue">{channel}</span>
          <span className="pco-badge bg-surface-gray text-ink-muted">{tone}</span>
        </div>
        <span>{new Date(date).toLocaleDateString('pt-BR')}</span>
      </div>
      <p className="text-sm text-ink-muted">{outcome}</p>
    </li>
  );
}
