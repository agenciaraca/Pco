import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Beaker, Play, Square, Trash2, Plus, X, Save, Loader2 } from 'lucide-react';
import { http } from '../../data/client';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import EmptyState from '../../components/EmptyState';

interface Experiment {
  id: string;
  name: string;
  description?: string;
  variants: string[];
  traffic: number;
  status: 'draft' | 'running' | 'concluded';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  concludedAt?: string;
  winnerVariant?: string;
}

interface AggregateRow {
  variant: string;
  assigned: number;
  converted: number;
  conversionRate: number;
}

const STATUS_LABEL: Record<Experiment['status'], string> = {
  draft: 'Rascunho',
  running: 'Rodando',
  concluded: 'Concluído',
};

const STATUS_STYLE: Record<Experiment['status'], string> = {
  draft: 'bg-surface-gray text-ink-muted',
  running: 'bg-pco-blue/10 text-pco-blue',
  concluded: 'bg-status-success/10 text-status-success',
};

export default function AdminExperiments() {
  useDocumentMeta({ title: 'A/B Experiments — Admin AVA PCO' });
  const qc = useQueryClient();
  const toast = useToast();
  const expsQ = useQuery({
    queryKey: ['admin', 'experiments'],
    queryFn: () => http.get<Experiment[]>('/admin/experiments'),
  });
  const [showCreate, setShowCreate] = useState(false);

  const createMut = useMutation({
    mutationFn: (input: { name: string; description?: string; variants: string[]; traffic: number }) =>
      http.post<Experiment>('/admin/experiments', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'experiments'] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Experiment> }) =>
      http.put<Experiment>(`/admin/experiments/${encodeURIComponent(id)}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'experiments'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      http.delete<{ ok: true }>(`/admin/experiments/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'experiments'] }),
  });

  async function handleStart(id: string) {
    try {
      await updateMut.mutateAsync({ id, patch: { status: 'running' } });
      toast.success('Experiment iniciado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleStop(id: string) {
    if (!confirm('Concluir experimento? Não vai mais atribuir novos usuários.')) return;
    try {
      await updateMut.mutateAsync({ id, patch: { status: 'concluded' } });
      toast.success('Concluído');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir experimento "${name}" e todos os eventos? Não há volta.`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Excluído');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">A/B Experiments</h1>
          <p className="pco-section-subtitle mt-1">
            Atribuição determinística por hash(userId|sessionId + experimentId).
            Use `useExperiment('id')` no front pra ler a variante.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo experiment
        </button>
      </header>

      {expsQ.isLoading ? (
        <div className="pco-card text-sm text-ink-muted">Carregando...</div>
      ) : !expsQ.data || expsQ.data.length === 0 ? (
        <div className="pco-card">
          <EmptyState
            icon={<Beaker size={26} className="text-pco-blue" strokeWidth={1.5} />}
            title="Nenhum experimento ainda"
            description='Clique em "Novo experiment" pra começar a testar variantes de UI.'
          />
        </div>
      ) : (
        <div className="space-y-3">
          {expsQ.data.map((e) => (
            <ExperimentCard
              key={e.id}
              experiment={e}
              onStart={() => handleStart(e.id)}
              onStop={() => handleStop(e.id)}
              onDelete={() => handleDelete(e.id, e.name)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateExperimentModal
          submitting={createMut.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={async (input) => {
            try {
              await createMut.mutateAsync(input);
              toast.success('Experiment criado', input.name);
              setShowCreate(false);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}
    </div>
  );
}

function ExperimentCard({
  experiment,
  onStart,
  onStop,
  onDelete,
}: {
  experiment: Experiment;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const resultsQ = useQuery({
    queryKey: ['admin', 'experiments', experiment.id, 'results'],
    queryFn: () =>
      http.get<{ rows: AggregateRow[] }>(`/admin/experiments/${encodeURIComponent(experiment.id)}/results`),
    enabled: experiment.status !== 'draft',
  });
  return (
    <div className="pco-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-pco-deep">{experiment.name}</h3>
            <span className={`pco-badge ${STATUS_STYLE[experiment.status]}`}>
              {STATUS_LABEL[experiment.status]}
            </span>
          </div>
          <div className="text-xs text-ink-subtle font-mono">{experiment.id}</div>
          {experiment.description && (
            <p className="text-xs text-ink-muted mt-1">{experiment.description}</p>
          )}
          <div className="text-xs text-ink-muted mt-1">
            {experiment.variants.length} variantes · traffic {experiment.traffic}%
          </div>
        </div>
        <div className="flex items-center gap-1">
          {experiment.status === 'draft' && (
            <button onClick={onStart} className="pco-btn-secondary text-xs" title="Iniciar">
              <Play size={11} strokeWidth={2} />
              Iniciar
            </button>
          )}
          {experiment.status === 'running' && (
            <button onClick={onStop} className="pco-btn-secondary text-xs" title="Concluir">
              <Square size={11} strokeWidth={2} />
              Concluir
            </button>
          )}
          {experiment.status !== 'running' && (
            <button
              onClick={onDelete}
              className="pco-btn-ghost text-xs text-status-danger"
              title="Excluir"
            >
              <Trash2 size={11} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {resultsQ.data && resultsQ.data.rows.length > 0 && (
        <div className="border-t border-surface-gray pt-3">
          <h4 className="text-xs uppercase tracking-wider text-ink-subtle font-semibold mb-2">
            Resultados
          </h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-subtle text-xs uppercase tracking-wider">
                <th className="text-left py-1.5 font-medium">Variante</th>
                <th className="text-right py-1.5 font-medium">Atribuídos</th>
                <th className="text-right py-1.5 font-medium">Conversões</th>
                <th className="text-right py-1.5 font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {resultsQ.data.rows.map((r) => (
                <tr key={r.variant} className="border-t border-surface-gray">
                  <td className="py-1.5 font-mono text-pco-deep">{r.variant}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.assigned}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.converted}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">
                    {(r.conversionRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateExperimentModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    description?: string;
    variants: string[];
    traffic: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [variantsRaw, setVariantsRaw] = useState('control\nvariant-a');
  const [traffic, setTraffic] = useState(100);

  const variants = variantsRaw
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
  const canSubmit = name.trim().length >= 2 && variants.length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Novo
            </div>
            <h2 className="text-lg font-bold text-pco-deep">Experimento A/B</h2>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-pco-deep" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">Nome</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pco-input"
              placeholder="Ex: Botão de checkout colorido"
              maxLength={120}
              autoFocus
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Descrição (opcional)
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="pco-input min-h-[64px]"
              placeholder="Hipótese a testar..."
              maxLength={500}
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Variantes (1 por linha, mín. 2)
            </div>
            <textarea
              value={variantsRaw}
              onChange={(e) => setVariantsRaw(e.target.value)}
              className="pco-input min-h-[96px] font-mono text-xs"
            />
            <p className="text-xs text-ink-subtle mt-1">
              Atual: {variants.length} variantes
            </p>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Traffic ({traffic}% dos usuários entram no experimento)
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={traffic}
              onChange={(e) => setTraffic(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-gray">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  description: description.trim() || undefined,
                  variants,
                  traffic,
                })
              }
              disabled={!canSubmit || submitting}
              className="pco-btn-primary text-xs"
            >
              {submitting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
