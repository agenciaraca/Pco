import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Copy,
  RefreshCw,
  AlertTriangle,
  Bot,
  ArrowLeft,
  History,
  CheckCircle2,
} from 'lucide-react';
import { useRetentionRisks } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import * as api from '../../data/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminRecoveryPlan() {
  useDocumentMeta({ title: 'Plano de Retomada IA — Admin' });
  const [params] = useSearchParams();
  const studentId = params.get('studentId') ?? '';
  const toast = useToast();
  const qc = useQueryClient();

  const risksQ = useRetentionRisks();
  const risks = risksQ.data ?? [];
  const risk = risks.find((r) => r.studentId === studentId);

  const historyQ = useQuery({
    queryKey: ['admin', 'recovery-plans', studentId],
    queryFn: () => api.fetchStudentRecoveryPlans(studentId),
    enabled: !!studentId,
  });
  const plans = historyQ.data?.plans ?? [];

  const [tone, setTone] = useState<'acolhedor' | 'direto' | 'motivacional'>('acolhedor');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'in_app'>('in_app');
  const [intensity, setIntensity] = useState<'leve' | 'media' | 'intensa'>('media');
  const [goal, setGoal] = useState('retomar_modulo');
  const [generatedPlan, setGeneratedPlan] = useState<api.RecoveryPlanDto | null>(null);
  const [editedMessage, setEditedMessage] = useState('');

  const generateMut = useMutation({
    mutationFn: () =>
      api.generateRecoveryPlan({
        studentId,
        tone,
        channel,
        intensity,
        goal,
        includeTutor: true,
        includePod: true,
        includeLibrary: true,
      }),
    onSuccess: (data) => {
      setGeneratedPlan(data.plan);
      setEditedMessage(data.plan.message);
      qc.invalidateQueries({ queryKey: ['admin', 'recovery-plans', studentId] });
      toast.success('Plano gerado com sucesso');
    },
    onError: (err) => {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro ao gerar plano');
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: api.RecoveryPlanDto['status'] }) =>
      api.updateRecoveryPlanStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'recovery-plans', studentId] });
      toast.success('Status atualizado');
    },
  });

  if (!studentId) {
    return (
      <div className="space-y-4">
        <Link to="/admin/evasao" className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={12} strokeWidth={2} /> Voltar
        </Link>
        <div className="pco-card p-6 text-center">
          <AlertTriangle size={24} className="mx-auto text-pco-orange mb-2" />
          <p className="text-sm text-ink-muted">Selecione um aluno no kanban de evasao para gerar um plano.</p>
          <Link to="/admin/evasao" className="pco-btn-primary text-xs mt-4 inline-flex">
            Ir para Evasao
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/evasao" className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={12} strokeWidth={2} /> Voltar ao kanban
      </Link>

      <header>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-pco-blue mb-2">
          <Sparkles size={14} strokeWidth={2} />
          Plano de retomada com IA
        </div>
        <h1 className="pco-section-title">
          Plano de Retomada — {risk?.studentName ?? studentId}
        </h1>
        <p className="pco-section-subtitle mt-1">
          A IA sugere. A decisao final e da equipe pedagogica.
        </p>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertTriangle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">
          Revise o plano antes de enviar ao aluno. Ajuste tom e conteudo conforme o contexto.
        </p>
      </div>

      {risk && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3">Dados do aluno</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Nome" value={risk.studentName} />
              <Row label="Ultimo acesso" value={new Date(risk.lastAccessAt).toLocaleDateString('pt-BR')} />
              <Row label="Progresso real" value={`${risk.realProgress}%`} />
              <Row label="Progresso esperado" value={`${risk.expectedProgress}%`} />
            </div>
          </div>

          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3">Score de evasao</h3>
            <div className="flex items-baseline gap-3">
              <div className="text-4xl font-bold text-pco-deep">{risk.score}</div>
              <span className={`pco-badge ${
                risk.level === 'critico' ? 'bg-status-danger/15 text-status-danger'
                  : risk.level === 'alto' ? 'bg-pco-orange/15 text-pco-orange'
                  : 'bg-pco-blue/10 text-pco-blue'
              }`}>
                {risk.level}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-surface-gray overflow-hidden">
              <div className="h-full rounded-full bg-status-danger" style={{ width: `${risk.score}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {risk.reasons.slice(0, 4).map((r) => (
                <span key={r} className="pco-badge bg-surface-gray text-ink-muted text-[10px]">{r}</span>
              ))}
            </div>
          </div>

          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
              <Bot size={16} className="text-pco-blue" strokeWidth={1.75} />
              Diagnostico
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              {generatedPlan?.diagnosis ?? `Score ${risk.score}/100. Progresso ${risk.realProgress}% vs esperado ${risk.expectedProgress}%. Razoes: ${risk.reasons.join(', ')}.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1 pco-card space-y-4">
          <h3 className="text-base font-semibold text-pco-deep">Configuracao</h3>

          <Field label="Tom">
            <select className="pco-input" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              <option value="acolhedor">Acolhedor</option>
              <option value="direto">Direto</option>
              <option value="motivacional">Motivacional</option>
            </select>
          </Field>

          <Field label="Canal">
            <select className="pco-input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
              <option value="in_app">In-app</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>

          <Field label="Intensidade">
            <select className="pco-input" value={intensity} onChange={(e) => setIntensity(e.target.value as typeof intensity)}>
              <option value="leve">Leve</option>
              <option value="media">Media</option>
              <option value="intensa">Intensa</option>
            </select>
          </Field>

          <Field label="Objetivo">
            <select className="pco-input" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="retomar_modulo">Retomar modulo atual</option>
              <option value="finalizar_avaliacao">Finalizar avaliacao</option>
              <option value="reativar_geral">Reativacao geral</option>
              <option value="apoio_emocional">Apoio emocional</option>
            </select>
          </Field>

          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="pco-btn-primary w-full justify-center text-xs"
          >
            {generateMut.isPending ? (
              <><RefreshCw size={12} className="animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles size={12} /> Gerar plano com IA</>
            )}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-5">
          {generatedPlan && (
            <>
              <div className="pco-card">
                <h3 className="text-base font-semibold text-pco-deep mb-2">Plano gerado</h3>
                <div className="grid sm:grid-cols-3 gap-2 mb-3 text-xs">
                  <Tile label="Meta semanal" value={`${generatedPlan.weeklyGoalMinutes} min`} />
                  <Tile label="Status" value={generatedPlan.status} />
                  {generatedPlan.aiProvider && (
                    <Tile label="Provider" value={`${generatedPlan.aiProvider} / ${generatedPlan.aiModel ?? ''}`} />
                  )}
                </div>
                {generatedPlan.suggestedTutorPrompt && (
                  <div className="text-xs bg-pco-blue/5 rounded-lg p-2 mb-3">
                    <strong className="text-pco-blue">Pergunta sugerida ao Tutor:</strong>{' '}
                    {generatedPlan.suggestedTutorPrompt}
                  </div>
                )}
              </div>

              <div className="pco-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-pco-deep">Mensagem</h3>
                  <span className="pco-badge bg-pco-blue/10 text-pco-blue">Revise antes de enviar</span>
                </div>
                <textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  rows={10}
                  className="pco-input font-mono text-xs leading-relaxed"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      statusMut.mutate({ id: generatedPlan.id, status: 'sent' });
                    }}
                    disabled={statusMut.isPending}
                    className="pco-btn-primary text-xs"
                  >
                    <Send size={12} /> Marcar como enviado
                  </button>
                  <button
                    onClick={() => navigator.clipboard?.writeText(editedMessage)}
                    className="pco-btn-ghost text-xs"
                  >
                    <Copy size={12} /> Copiar
                  </button>
                </div>
              </div>
            </>
          )}

          {!generatedPlan && (
            <div className="pco-card p-8 text-center text-sm text-ink-muted">
              Configure os parametros e clique em "Gerar plano com IA" para comecar.
            </div>
          )}
        </div>
      </div>

      {plans.length > 0 && (
        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
            <History size={16} className="text-ink-muted" strokeWidth={1.75} />
            Historico de planos ({plans.length})
          </h3>
          <ul className="divide-y divide-surface-gray">
            {plans.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex gap-2">
                    <span className="pco-badge bg-pco-blue/10 text-pco-blue">{p.channel}</span>
                    <span className="pco-badge bg-surface-gray text-ink-muted">{p.tone}</span>
                    <span className={`pco-badge ${
                      p.status === 'completed' ? 'bg-status-success/10 text-status-success'
                        : p.status === 'sent' ? 'bg-pco-blue/10 text-pco-blue'
                        : 'bg-surface-gray text-ink-muted'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <span className="text-ink-subtle">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm text-ink-muted line-clamp-2">{p.message}</p>
                {p.status !== 'completed' && (
                  <div className="mt-2 flex gap-2">
                    {p.status === 'draft' && (
                      <button
                        onClick={() => statusMut.mutate({ id: p.id, status: 'sent' })}
                        className="text-xs text-pco-blue hover:underline"
                      >
                        Marcar enviado
                      </button>
                    )}
                    {p.status === 'sent' && (
                      <button
                        onClick={() => statusMut.mutate({ id: p.id, status: 'in_followup' })}
                        className="text-xs text-pco-blue hover:underline"
                      >
                        Em acompanhamento
                      </button>
                    )}
                    {(p.status === 'sent' || p.status === 'in_followup') && (
                      <button
                        onClick={() => statusMut.mutate({ id: p.id, status: 'completed' })}
                        className="text-xs text-status-success hover:underline inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={10} /> Concluir
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
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

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-pco-deep">{value}</span>
    </div>
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
