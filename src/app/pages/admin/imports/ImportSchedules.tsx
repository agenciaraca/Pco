import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  Edit3,
  PlayCircle,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  useImportSchedules,
  useCreateImportSchedule,
  useUpdateImportSchedule,
  useDeleteImportSchedule,
  useRunImportScheduleNow,
  useImportConnections,
} from '../../../data/hooks';
import { useToast } from '../../../components/Toast';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';
import type {
  ImportEntityTypeDto,
  ImportScheduleDto,
  ImportScheduleInputDto,
  ScheduleFrequencyDto,
  WeekdayDto,
} from '../../../data/api';

const ENTITY_LABELS: Record<ImportEntityTypeDto, string> = {
  student: 'Alunos',
  course: 'Cursos',
  module: 'Módulos',
  lesson: 'Aulas',
  topic: 'Tópicos',
  quiz: 'Quizzes',
  question: 'Questões',
  group: 'Grupos',
  product: 'Produtos',
  order: 'Pedidos',
  enrollment: 'Matrículas',
  progress: 'Progresso',
};

const ALL_ENTITIES = Object.keys(ENTITY_LABELS) as ImportEntityTypeDto[];

const WEEKDAY_LABELS: Record<WeekdayDto, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export default function ImportSchedules() {
  useDocumentMeta({ title: 'Schedules de Import — Admin' });
  const list = useImportSchedules();
  const conns = useImportConnections();
  const create = useCreateImportSchedule();
  const update = useUpdateImportSchedule();
  const del = useDeleteImportSchedule();
  const runNow = useRunImportScheduleNow();
  const toast = useToast();
  const navigate = useNavigate();

  const [editing, setEditing] = useState<ImportScheduleDto | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <Link
          to="/admin/imports"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep mt-1 flex items-center gap-2">
          <Calendar size={20} className="text-pco-cyan" strokeWidth={1.75} />
          Schedules de importação
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Agendamentos diários ou semanais. O worker dispara automaticamente o
          dryRun ou execução real conforme configurado.
        </p>
      </header>

      <div>
        {list.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhum schedule. Crie o primeiro abaixo.
          </div>
        ) : (
          <ul className="space-y-2">
            {(list.data ?? []).map((s) => {
              const conn = (conns.data ?? []).find((c) => c.id === s.connectionId);
              return (
                <li key={s.id} className="pco-card p-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`pco-badge text-xs ${
                            s.enabled
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-surface-gray text-ink-muted'
                          }`}
                        >
                          {s.enabled ? 'ativo' : 'pausado'}
                        </span>
                        <span className="pco-badge text-xs bg-pco-blue/10 text-pco-blue">
                          {s.dryRun ? 'dry-run' : 'real'}
                        </span>
                        <span className="text-sm font-semibold text-pco-deep">
                          {s.name}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted mt-1">
                        {conn?.name ?? '(conexão removida)'} ·{' '}
                        {s.frequency === 'daily'
                          ? 'todo dia'
                          : `toda ${WEEKDAY_LABELS[s.weekday ?? 1].toLowerCase()}`}{' '}
                        às {pad(s.hourUtc)}:{pad(s.minute)} UTC
                      </div>
                      <div className="text-xs text-ink-subtle mt-0.5">
                        Entidades: {s.entities.length > 0 ? s.entities.map((e) => ENTITY_LABELS[e] ?? e).join(', ') : '—'}
                      </div>
                      <div className="text-xs text-ink-subtle mt-0.5">
                        {s.lastRunAt && (
                          <>
                            <CheckCircle2 size={9} className="inline" /> última:{' '}
                            {new Date(s.lastRunAt).toLocaleString('pt-BR')}{' '}
                          </>
                        )}
                        {s.nextRunAt && (
                          <>
                            · <Clock size={9} className="inline" /> próxima:{' '}
                            {new Date(s.nextRunAt).toLocaleString('pt-BR')}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await runNow.mutateAsync(s.id);
                          toast.success('Executando agora');
                          navigate(`/admin/imports/jobs/${r.jobId}`);
                        } catch (err) {
                          toast.error(
                            'Falha',
                            err instanceof Error ? err.message : 'Erro',
                          );
                        }
                      }}
                      disabled={runNow.isPending}
                      className="pco-btn-ghost text-xs"
                      title="Executar agora (sem esperar próxima janela)"
                    >
                      <PlayCircle size={11} strokeWidth={2} />
                      Rodar agora
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await update.mutateAsync({
                            id: s.id,
                            input: { enabled: !s.enabled },
                          });
                          toast.success(s.enabled ? 'Pausado' : 'Ativado');
                        } catch (err) {
                          toast.error(
                            'Falha',
                            err instanceof Error ? err.message : 'Erro',
                          );
                        }
                      }}
                      className="pco-btn-ghost text-xs"
                    >
                      {s.enabled ? 'Pausar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="pco-btn-ghost text-xs"
                    >
                      <Edit3 size={11} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Excluir schedule ${s.name}?`)) return;
                        try {
                          await del.mutateAsync(s.id);
                          toast.success('Removido');
                        } catch (err) {
                          toast.error(
                            'Falha',
                            err instanceof Error ? err.message : 'Erro',
                          );
                        }
                      }}
                      className="pco-btn-ghost text-xs text-status-danger"
                    >
                      <Trash2 size={11} strokeWidth={2} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!editing && !creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="pco-btn-primary"
        >
          <Plus size={12} strokeWidth={2} />
          Novo schedule
        </button>
      )}

      {(editing || creating) && (
        <ScheduleEditor
          editing={editing}
          connections={conns.data ?? []}
          onSave={async (input) => {
            try {
              if (editing) {
                await update.mutateAsync({ id: editing.id, input });
                toast.success('Atualizado');
              } else {
                await create.mutateAsync(input as ImportScheduleInputDto);
                toast.success('Criado');
              }
              setEditing(null);
              setCreating(false);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function ScheduleEditor({
  editing,
  connections,
  onSave,
  onCancel,
}: {
  editing: ImportScheduleDto | null;
  connections: { id: string; name: string }[];
  onSave: (input: Partial<ImportScheduleInputDto>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [connectionId, setConnectionId] = useState(
    editing?.connectionId ?? connections[0]?.id ?? '',
  );
  const [frequency, setFrequency] = useState<ScheduleFrequencyDto>(
    editing?.frequency ?? 'daily',
  );
  const [hourUtc, setHourUtc] = useState(editing?.hourUtc ?? 3);
  const [minute, setMinute] = useState(editing?.minute ?? 0);
  const [weekday, setWeekday] = useState<WeekdayDto>(
    (editing?.weekday ?? 1) as WeekdayDto,
  );
  const [entities, setEntities] = useState<ImportEntityTypeDto[]>(
    editing?.entities ?? ['student', 'course', 'enrollment'],
  );
  const [dryRun, setDryRun] = useState(editing?.dryRun ?? true);

  const canSave = useMemo(
    () => name.trim().length > 0 && !!connectionId && entities.length > 0,
    [name, connectionId, entities],
  );

  function toggleEntity(e: ImportEntityTypeDto) {
    setEntities((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  return (
    <section className="pco-card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.name}` : 'Novo schedule'}
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            Nome
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="pco-input mt-1 text-sm w-full"
            placeholder="Ex: Sync diário portalpco"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            Conexão
          </span>
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            className="pco-input mt-1 text-sm w-full"
          >
            <option value="">Selecione...</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            Frequência
          </span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ScheduleFrequencyDto)}
            className="pco-input mt-1 text-sm"
          >
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
        </label>
        {frequency === 'weekly' && (
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Dia da semana
            </span>
            <select
              value={weekday}
              onChange={(e) =>
                setWeekday(Number(e.target.value) as WeekdayDto)
              }
              className="pco-input mt-1 text-sm"
            >
              {([0, 1, 2, 3, 4, 5, 6] as WeekdayDto[]).map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            Hora (UTC)
          </span>
          <input
            type="number"
            value={hourUtc}
            onChange={(e) => setHourUtc(Number(e.target.value))}
            min={0}
            max={23}
            className="pco-input mt-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            Minuto
          </span>
          <input
            type="number"
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            min={0}
            max={59}
            className="pco-input mt-1 text-sm"
          />
        </label>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          Entidades
        </span>
        <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 mt-1">
          {ALL_ENTITIES.map((e) => (
            <label
              key={e}
              className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-surface-mute cursor-pointer"
            >
              <input
                type="checkbox"
                checked={entities.includes(e)}
                onChange={() => toggleEntity(e)}
                className="accent-pco-blue"
              />
              {ENTITY_LABELS[e]}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
          className="accent-pco-blue"
        />
        Dry-run (não grava — apenas valida)
      </label>

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="pco-btn-ghost text-xs">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              name: name.trim(),
              connectionId,
              frequency,
              hourUtc,
              minute,
              weekday: frequency === 'weekly' ? weekday : undefined,
              entities,
              dryRun,
            })
          }
          disabled={!canSave}
          className="pco-btn-primary"
        >
          {editing ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </section>
  );
}
