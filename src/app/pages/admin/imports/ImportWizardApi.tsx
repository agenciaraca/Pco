import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Cloud,
  Plus,
  Trash2,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PlayCircle,
  Edit3,
  ShieldCheck,
  Layers,
  Zap,
  GripVertical,
} from 'lucide-react';
import {
  useImportConnections,
  useCreateImportConnection,
  useUpdateImportConnection,
  useDeleteImportConnection,
  useTestImportConnection,
  useStartApiRun,
} from '../../../data/hooks';
import { useToast } from '../../../components/Toast';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';
import type {
  ConflictStrategyDto,
  ConnectionDiagnoseResult,
  ConnectionDiagnoseLdResult,
  EnrollmentExpirationRuleDto,
  EnrollmentStartRuleDto,
  ImportConnectionDto,
  ImportEntityTypeDto,
  UserMatchKeyDto,
} from '../../../data/api';
import { diagnoseImportConnection, diagnoseImportConnectionLd } from '../../../data/api';

const ENTITY_GROUPS: Array<{
  source: 'wp' | 'ld' | 'wc';
  label: string;
  entities: Array<{ id: ImportEntityTypeDto; label: string; hint: string }>;
}> = [
  {
    source: 'wp',
    label: 'WordPress',
    entities: [
      { id: 'student', label: 'Alunos / usuários', hint: '/wp-json/wp/v2/users' },
    ],
  },
  {
    source: 'ld',
    label: 'LearnDash',
    entities: [
      { id: 'course', label: 'Cursos', hint: '/sfwd-courses' },
      { id: 'lesson', label: 'Aulas', hint: '/sfwd-lessons' },
      { id: 'topic', label: 'Tópicos', hint: '/sfwd-topic' },
      { id: 'quiz', label: 'Quizzes', hint: '/sfwd-quiz' },
      { id: 'question', label: 'Questões', hint: '/sfwd-question' },
      { id: 'group', label: 'Grupos', hint: '/groups' },
      { id: 'enrollment', label: 'Matrículas', hint: 'courses/{id}/users' },
      { id: 'progress', label: 'Progresso', hint: 'users/{id}/course-progress' },
    ],
  },
  {
    source: 'wc',
    label: 'WooCommerce (opcional)',
    entities: [
      { id: 'product', label: 'Produtos', hint: '/wc/v3/products' },
      { id: 'order', label: 'Pedidos', hint: '/wc/v3/orders' },
    ],
  },
];

const SOURCE_BADGE: Record<'wp' | 'ld' | 'wc', string> = {
  wp: 'bg-pco-blue/10 text-pco-blue',
  ld: 'bg-pco-cyan/15 text-pco-cyan',
  wc: 'bg-pco-orange/10 text-pco-orange',
};

const ALL_MATCH_KEYS: UserMatchKeyDto[] = [
  'email',
  'document',
  'external_id',
  'wp_user_id',
];

export default function ImportWizardApi() {
  useDocumentMeta({ title: 'Importação API — Admin' });
  const conns = useImportConnections();
  const create = useCreateImportConnection();
  const update = useUpdateImportConnection();
  const del = useDeleteImportConnection();
  const test = useTestImportConnection();
  const startApi = useStartApiRun();
  const toast = useToast();
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [diagnoseLdResult, setDiagnoseLdResult] = useState<
    (ConnectionDiagnoseLdResult & { connId: string }) | null
  >(null);
  const [diagnoseResult, setDiagnoseResult] = useState<
    (ConnectionDiagnoseResult & { connId: string }) | null
  >(null);
  const editing = useMemo(
    () => (conns.data ?? []).find((c) => c.id === editingId) ?? null,
    [conns.data, editingId],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedConn = useMemo(
    () => (conns.data ?? []).find((c) => c.id === selectedId) ?? null,
    [conns.data, selectedId],
  );
  // Auto-selecciona primeira conexão se ainda nenhuma escolhida
  useMemo(() => {
    if (!selectedId && conns.data && conns.data.length > 0) {
      setSelectedId(conns.data[0]!.id);
    }
  }, [conns.data, selectedId]);

  const [entities, setEntities] = useState<ImportEntityTypeDto[]>([
    'student',
    'course',
    'enrollment',
  ]);
  const [dryRun, setDryRun] = useState(true);
  const [startRule, setStartRule] = useState<EnrollmentStartRuleDto>('paid_date');
  const [expirationRule, setExpirationRule] =
    useState<EnrollmentExpirationRuleDto>('start_plus_duration');
  const [defaultDuration, setDefaultDuration] = useState<number>(365);
  const [matchKeys, setMatchKeys] = useState<UserMatchKeyDto[]>([
    'email',
    'document',
    'external_id',
  ]);
  const [unmatchedUserPolicy, setUnmatchedUserPolicy] = useState<
    'skip' | 'create_stub' | 'error'
  >('skip');
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategyDto>('update');
  // Quando true, rows com erros de validacao (ex: email vazio em order)
  // ainda sao processados — adapter decide se aceita.
  const [skipValidationErrors, setSkipValidationErrors] = useState(false);

  // Pré-carrega defaults da conexão selecionada (apenas quando muda de conexão)
  const [lastAppliedDefaultsFor, setLastAppliedDefaultsFor] = useState<string | null>(
    null,
  );
  useMemo(() => {
    if (
      selectedConn &&
      selectedConn.id !== lastAppliedDefaultsFor &&
      (selectedConn.defaultUserMatchKeys || selectedConn.defaultConflictStrategy)
    ) {
      if (selectedConn.defaultUserMatchKeys?.length) {
        setMatchKeys(selectedConn.defaultUserMatchKeys);
      }
      if (selectedConn.defaultConflictStrategy) {
        setConflictStrategy(selectedConn.defaultConflictStrategy);
      }
      setLastAppliedDefaultsFor(selectedConn.id);
    }
  }, [selectedConn, lastAppliedDefaultsFor]);

  function toggleEntity(e: ImportEntityTypeDto) {
    setEntities((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  function moveMatchKey(key: UserMatchKeyDto, dir: -1 | 1) {
    setMatchKeys((prev) => {
      const i = prev.indexOf(key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function toggleMatchKey(key: UserMatchKeyDto) {
    setMatchKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleStart() {
    if (!selectedId) {
      toast.error('Selecione', 'Escolha uma conexão acima.');
      return;
    }
    if (entities.length === 0) {
      toast.error('Selecione', 'Marque ao menos uma entidade.');
      return;
    }
    if (matchKeys.length === 0) {
      toast.error('Match keys', 'Selecione ao menos uma chave de vínculo.');
      return;
    }
    if (!dryRun) {
      const ok = confirm(
        `EXECUÇÃO REAL?\n\nVai puxar e gravar dados de:\n${entities.join(', ')}.\nProsseguir?`,
      );
      if (!ok) return;
    }
    try {
      const r = await startApi.mutateAsync({
        connectionId: selectedId,
        entities,
        dryRun,
        enrollment: {
          startRule,
          expirationRule,
          defaultAccessDurationDays: defaultDuration,
          userMatchKeys: matchKeys,
          unmatchedUserPolicy,
          conflictStrategy,
          skipValidationErrors,
        },
      });
      toast.success(`${r.dryRun ? 'Dry-run' : 'Execução real'} iniciada`);
      navigate(`/admin/imports/jobs/${r.jobId}`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

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
          <Cloud size={20} className="text-pco-cyan" strokeWidth={1.75} />
          Importação via API (WordPress + LearnDash + WooCommerce)
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Importação modular: escolha de qual site puxar e quais entidades. Pode rodar
          várias importações de origens diferentes — o e-mail (ou CPF) é a chave
          universal de vínculo do aluno.
        </p>
      </header>

      {/* 1) CONEXÕES */}
      <Section
        step="1"
        title="Conexões"
        description="Aponta para um site WordPress. Você pode ter quantas quiser."
      >
        {conns.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (conns.data ?? []).length === 0 ? (
          <div className="pco-card p-4 text-center text-sm text-ink-muted">
            Nenhuma conexão ainda. Cadastre a primeira abaixo.
          </div>
        ) : (
          <ul className="space-y-2">
            {(conns.data ?? []).map((c) => (
              <li
                key={c.id}
                className={`pco-card p-3 ${
                  selectedId === c.id ? 'border-pco-blue/40 bg-pco-blue/5' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="radio"
                    name="conn"
                    checked={selectedId === c.id}
                    onChange={() => setSelectedId(c.id)}
                    className="accent-pco-blue"
                  />
                  <div className="flex-1 min-w-[260px]">
                    <div className="text-sm font-semibold text-pco-deep">{c.name}</div>
                    <div className="text-[11px] text-ink-subtle break-all">
                      {c.siteUrl}
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5 space-x-2">
                      <span
                        className={
                          c.hasWpAppPassword
                            ? 'text-status-success'
                            : 'text-pco-orange'
                        }
                      >
                        {c.hasWpAppPassword ? '✓ WP+LD' : '⚠ WP+LD sem senha'}
                      </span>
                      <span className="text-ink-subtle">·</span>
                      <span
                        className={
                          c.hasWcConsumerKey && c.hasWcConsumerSecret
                            ? 'text-status-success'
                            : 'text-ink-subtle'
                        }
                      >
                        {c.hasWcConsumerKey && c.hasWcConsumerSecret
                          ? '✓ WooCommerce'
                          : '○ sem WooCommerce'}
                      </span>
                    </div>
                    {c.lastTestedAt && c.lastTestStatus && (
                      <div
                        className={`text-[11px] mt-0.5 ${
                          c.lastTestStatus === 'ok'
                            ? 'text-status-success'
                            : 'text-status-danger'
                        }`}
                      >
                        {c.lastTestStatus === 'ok' ? (
                          <CheckCircle2 size={10} className="inline" />
                        ) : (
                          <AlertCircle size={10} className="inline" />
                        )}{' '}
                        último teste:{' '}
                        {new Date(c.lastTestedAt).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await test.mutateAsync(c.id);
                        const lines: string[] = [];
                        lines.push(`WP: ${r.wp.ok ? 'OK' : 'FALHOU'} — ${r.wp.message}`);
                        lines.push(
                          `LD: ${r.ld.ok ? 'OK' : 'FALHOU'} — ${r.ld.message}`,
                        );
                        if (r.wc.skipped) {
                          lines.push('WC: não configurado (opcional)');
                        } else {
                          lines.push(
                            `WC: ${r.wc.ok ? 'OK' : 'FALHOU'} — ${r.wc.message}`,
                          );
                        }
                        toast[r.overall === 'ok' ? 'success' : 'error'](
                          `Teste ${r.overall.toUpperCase()}`,
                          lines.join('\n'),
                        );
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    disabled={test.isPending}
                    className="pco-btn-ghost text-xs"
                  >
                    <Wifi size={11} strokeWidth={2} />
                    {test.isPending ? 'Testando...' : 'Testar'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await diagnoseImportConnection(c.id);
                        setDiagnoseResult({ connId: c.id, ...r });
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs"
                    title="Diagnóstico detalhado WP: verifica role do user e permissões REST"
                  >
                    🔬
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await diagnoseImportConnectionLd(c.id);
                        setDiagnoseLdResult({ connId: c.id, ...r });
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs"
                    title="Diagnóstico detalhado LearnDash: verifica plugin, namespace e endpoints"
                  >
                    🎓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(c.id);
                      setCreating(false);
                    }}
                    className="pco-btn-ghost text-xs"
                  >
                    <Edit3 size={11} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Excluir conexão ${c.name}?`)) return;
                      try {
                        await del.mutateAsync(c.id);
                        if (selectedId === c.id) setSelectedId(null);
                        toast.success('Removida');
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
            ))}
          </ul>
        )}

        {!editing && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="pco-btn-ghost text-xs"
          >
            <Plus size={11} strokeWidth={2} />
            Nova conexão
          </button>
        )}

        {(editing || creating) && (
          <ConnectionEditor
            editing={editing}
            onSave={async (input) => {
              try {
                if (editing) {
                  await update.mutateAsync({ id: editing.id, input });
                  toast.success('Conexão atualizada');
                } else {
                  const r = await create.mutateAsync(input);
                  setSelectedId(r.id);
                  toast.success('Conexão criada');
                }
                setEditingId(null);
                setCreating(false);
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            onCancel={() => {
              setEditingId(null);
              setCreating(false);
            }}
          />
        )}
      </Section>

      {/* 2) O QUE IMPORTAR */}
      <Section
        step="2"
        title="O que importar"
        description="Granular: pode marcar só cursos, só alunos, ou qualquer combinação."
      >
        <div className="space-y-3">
          {ENTITY_GROUPS.map((group) => (
            <div key={group.source} className="pco-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`pco-badge text-[10px] ${SOURCE_BADGE[group.source]}`}
                >
                  {group.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const ids = group.entities.map((e) => e.id);
                    const allSelected = ids.every((id) => entities.includes(id));
                    if (allSelected) {
                      setEntities((prev) => prev.filter((id) => !ids.includes(id)));
                    } else {
                      setEntities((prev) => [
                        ...prev.filter((id) => !ids.includes(id)),
                        ...ids,
                      ]);
                    }
                  }}
                  className="text-[11px] text-pco-blue hover:underline ml-auto"
                >
                  selecionar tudo
                </button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                {group.entities.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-surface-mute cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={entities.includes(e.id)}
                      onChange={() => toggleEntity(e.id)}
                      className="accent-pco-blue mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-pco-deep">{e.label}</div>
                      <div className="text-ink-subtle font-mono text-[10px]">
                        {e.hint}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 3) MATCH KEYS */}
      <Section
        step="3"
        title="Como vincular alunos"
        description="Ao importar matrículas/pedidos/progresso, o sistema busca o aluno pelas chaves abaixo na ORDEM. A primeira que achar vence."
      >
        <div className="pco-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
            <Layers size={14} className="text-pco-blue" strokeWidth={1.75} />
            Ordem de prioridade
          </div>
          {matchKeys.length === 0 ? (
            <div className="text-xs text-pco-orange">
              Nenhuma chave selecionada — adicione ao menos uma abaixo.
            </div>
          ) : (
            <ul className="space-y-1">
              {matchKeys.map((key, i) => (
                <li
                  key={key}
                  className="flex items-center gap-2 p-2 rounded border border-pco-border bg-white"
                >
                  <GripVertical size={12} className="text-ink-subtle" />
                  <span className="text-[10px] font-mono w-6 text-ink-muted">
                    #{i + 1}
                  </span>
                  <span className="flex-1 text-sm text-pco-deep">
                    {keyLabel(key)}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveMatchKey(key, -1)}
                    disabled={i === 0}
                    className="pco-btn-ghost text-xs disabled:opacity-30"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMatchKey(key, 1)}
                    disabled={i === matchKeys.length - 1}
                    className="pco-btn-ghost text-xs disabled:opacity-30"
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMatchKey(key)}
                    className="pco-btn-ghost text-xs text-status-danger"
                    title="Remover"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ALL_MATCH_KEYS.some((k) => !matchKeys.includes(k)) && (
            <div>
              <span className="text-[11px] text-ink-muted mr-2">
                Adicionar chave:
              </span>
              {ALL_MATCH_KEYS.filter((k) => !matchKeys.includes(k)).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleMatchKey(k)}
                  className="pco-btn-ghost text-xs mr-1"
                >
                  + {keyLabel(k)}
                </button>
              ))}
            </div>
          )}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Quando aluno não encontrado
            </span>
            <select
              value={unmatchedUserPolicy}
              onChange={(e) =>
                setUnmatchedUserPolicy(
                  e.target.value as typeof unmatchedUserPolicy,
                )
              }
              className="pco-input mt-1 text-sm"
            >
              <option value="skip">Ignorar registro (recomendado)</option>
              <option value="create_stub">
                Criar aluno mínimo com o e-mail do registro
              </option>
              <option value="error">Marcar como erro</option>
            </select>
          </label>
        </div>
      </Section>

      {/* 4) CONFLITO */}
      <Section
        step="4"
        title="Quando registro já existe"
        description="O que fazer ao re-importar algo que já está no AVA."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <ConflictOption
            value="update"
            current={conflictStrategy}
            label="Atualizar (recomendado)"
            description="Sobrescreve campos com os dados novos"
            onSelect={setConflictStrategy}
          />
          <ConflictOption
            value="ignore"
            current={conflictStrategy}
            label="Ignorar"
            description="Pula registros já existentes; importa só os novos"
            onSelect={setConflictStrategy}
          />
          <ConflictOption
            value="merge"
            current={conflictStrategy}
            label="Mesclar"
            description="Combina dados (mantém valores existentes não-vazios)"
            onSelect={setConflictStrategy}
          />
          <ConflictOption
            value="error"
            current={conflictStrategy}
            label="Marcar como erro"
            description="Reporta erro em registros duplicados"
            onSelect={setConflictStrategy}
          />
        </div>

        <label className="mt-4 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipValidationErrors}
            onChange={(e) => setSkipValidationErrors(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          <span className="text-sm">
            <span className="font-medium text-pco-deep">
              Tolerar erros de validação
            </span>
            <span className="block text-xs text-ink-muted mt-0.5">
              Importa mesmo registros com problemas (ex.: pedidos sem e-mail
              do cliente, status desconhecido). Os erros viram avisos no log
              em vez de bloquear o registro. Útil pra dados legados.
            </span>
          </span>
        </label>
      </Section>

      {/* 5) REGRAS DE MATRÍCULA */}
      {entities.includes('enrollment') && (
        <Section
          step="5"
          title="Regras de matrícula"
          description="Aplicadas só ao importar matrículas. Define datas de início e expiração."
        >
          <div className="pco-card p-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                Data inicial
              </span>
              <select
                value={startRule}
                onChange={(e) =>
                  setStartRule(e.target.value as EnrollmentStartRuleDto)
                }
                className="pco-input mt-1 text-sm"
              >
                <option value="paid_date">Pagamento</option>
                <option value="completed_date">Conclusão pedido</option>
                <option value="order_date">Data pedido</option>
                <option value="imported">CSV/API</option>
                <option value="now">Agora</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                Expiração
              </span>
              <select
                value={expirationRule}
                onChange={(e) =>
                  setExpirationRule(e.target.value as EnrollmentExpirationRuleDto)
                }
                className="pco-input mt-1 text-sm"
              >
                <option value="start_plus_duration">Início + duração</option>
                <option value="order_plus_duration">Pedido + duração</option>
                <option value="paid_plus_duration">Pagamento + duração</option>
                <option value="completed_plus_duration">Conclusão + duração</option>
                <option value="explicit">Importada</option>
                <option value="lifetime">Vitalícia</option>
                <option value="course_fixed_end">Data fixa</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                Dias padrão
              </span>
              <input
                type="number"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                min={0}
                className="pco-input mt-1 text-sm"
              />
            </label>
          </div>
        </Section>
      )}

      {/* 6) EXECUTAR */}
      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3 items-start text-xs">
        <ShieldCheck size={16} className="text-pco-blue shrink-0 mt-0.5" />
        <div className="text-ink-muted">
          <strong className="text-pco-deep">Sempre faça dry-run primeiro</strong> — ele
          lê e valida tudo sem gravar. Só depois execute o real.
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {selectedConn && (
          <button
            type="button"
            onClick={async () => {
              try {
                await update.mutateAsync({
                  id: selectedConn.id,
                  input: {
                    defaultUserMatchKeys: matchKeys,
                    defaultConflictStrategy: conflictStrategy,
                  },
                });
                toast.success(
                  'Padrões salvos',
                  'Match keys e estratégia memorizados nessa conexão.',
                );
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            disabled={update.isPending}
            className="pco-btn-ghost text-xs"
            title="Memoriza match keys e conflict strategy nessa conexão para próximas runs"
          >
            Salvar como padrão da conexão
          </button>
        )}
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="accent-pco-blue"
          />
          Dry-run (não grava nada)
        </label>
        <button
          type="button"
          onClick={handleStart}
          disabled={
            startApi.isPending ||
            !selectedId ||
            entities.length === 0 ||
            matchKeys.length === 0
          }
          className="pco-btn-primary"
        >
          {startApi.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : dryRun ? (
            <Zap size={14} strokeWidth={2} />
          ) : (
            <PlayCircle size={14} strokeWidth={2} />
          )}
          {dryRun ? 'Iniciar dry-run' : 'Executar importação real'}
        </button>
      </div>

      {diagnoseResult && (
        <DiagnoseModal
          result={diagnoseResult}
          onClose={() => setDiagnoseResult(null)}
        />
      )}
      {diagnoseLdResult && (
        <DiagnoseLdModal
          result={diagnoseLdResult}
          onClose={() => setDiagnoseLdResult(null)}
        />
      )}
    </div>
  );
}

function DiagnoseLdModal({
  result,
  onClose,
}: {
  result: ConnectionDiagnoseLdResult & { connId: string };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="pco-card w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-pco-deep">🎓 Diagnóstico LearnDash</h2>
          <button type="button" onClick={onClose} className="pco-btn-ghost text-xs">
            Fechar
          </button>
        </div>

        <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-3 text-sm">
          <strong className="text-pco-deep">Resumo:</strong>{' '}
          <span className="text-ink-muted">{result.hint}</span>
        </div>

        <DiagRow
          label="Namespace ldlms/v2 publicado em /wp-json"
          ok={result.rootNamespacesIncludesLdlms}
          value={result.rootNamespacesIncludesLdlms ? 'Sim' : 'Não'}
          detail={
            result.rootNamespaces.length > 0
              ? `Namespaces detectados: ${result.rootNamespaces.slice(0, 12).join(', ')}${
                  result.rootNamespaces.length > 12 ? ` (+${result.rootNamespaces.length - 12})` : ''
                }`
              : 'Nenhum namespace detectado em /wp-json — verifique se o WP REST está ativo.'
          }
        />

        <div className="space-y-2">
          <strong className="text-sm text-pco-deep">Endpoints testados:</strong>
          {result.endpoints.map((e) => (
            <DiagRow
              key={e.path}
              label={e.path}
              ok={e.ok}
              value={e.status === 0 ? 'rede' : `HTTP ${e.status}`}
              detail={e.detail}
            />
          ))}
        </div>

        {result.rawRoutesPreview && result.rawRoutesPreview.length > 0 && (
          <details className="pco-card border-pco-border p-3 text-[11px]">
            <summary className="cursor-pointer text-ink-muted">
              Rotas LD detectadas ({result.rawRoutesPreview.length})
            </summary>
            <ul className="mt-2 space-y-0.5 font-mono text-pco-deep">
              {result.rawRoutesPreview.map((r) => (
                <li key={r} className="break-all">
                  {r}
                </li>
              ))}
            </ul>
          </details>
        )}

        {result.customSlugs && result.customSlugs.length > 0 && (
          <div className="pco-card border-pco-cyan/30 bg-pco-cyan/5 p-3 text-xs space-y-2">
            <strong className="text-pco-deep">
              Slugs customizados detectados ({result.customSlugs.length})
            </strong>
            <p className="text-ink-muted">
              Este site customizou os slugs do REST API. O AVA descobriu e está
              usando os slugs corretos automaticamente.
            </p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-ink-subtle border-b border-pco-border">
                  <th className="text-left pb-1">Entidade</th>
                  <th className="text-left pb-1">Padrão</th>
                  <th className="text-left pb-1">Neste site</th>
                </tr>
              </thead>
              <tbody>
                {result.customSlugs.map((s) => (
                  <tr key={s.entity} className="border-b border-pco-border/30">
                    <td className="py-1 font-medium text-pco-deep">{s.entity}</td>
                    <td className="py-1 font-mono text-ink-muted">{s.default}</td>
                    <td className="py-1 font-mono text-pco-blue">{s.actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!result.rootNamespacesIncludesLdlms && (
          <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-3 text-xs space-y-1">
            <strong className="text-pco-deep">Como resolver:</strong>
            <ol className="list-decimal pl-5 space-y-0.5 text-ink-muted">
              <li>WP-Admin → Plugins: confirme que LearnDash LMS está ativado.</li>
              <li>
                WP-Admin → LearnDash LMS → Configurações → REST API: marque "Ativar REST API".
              </li>
              <li>
                Plugins de segurança (Wordfence, iThemes, WP Cerber) podem bloquear REST API
                não-padrão. Whitelist o user da Application Password.
              </li>
              <li>Após salvar, clique em 🎓 novamente para validar.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnoseModal({
  result,
  onClose,
}: {
  result: ConnectionDiagnoseResult & { connId: string };
  onClose: () => void;
}) {
  const usersAccessOk = result.usersListOk;
  const isAdmin = result.meRoles.includes('administrator');
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="pco-card w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-pco-deep">
            🔬 Diagnóstico WordPress
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="pco-btn-ghost text-xs"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <DiagRow
            label="REST API ativa"
            ok={result.rootOk}
            value={`HTTP ${result.rootStatus}`}
            detail={result.rootMessage}
          />
          <DiagRow
            label="Autenticação (/users/me)"
            ok={result.meOk}
            value={
              result.meUser
                ? `${result.meUser} · roles: ${result.meRoles.join(', ') || '(vazio)'}`
                : `HTTP ${result.meStatus}`
            }
            detail={
              result.meOk
                ? isAdmin
                  ? '✓ Usuário tem role administrator — pode listar usuários'
                  : `⚠ Usuário NÃO é administrator (roles: ${result.meRoles.join(', ') || 'nenhum'}). Para importar todos os alunos com email, mude o role para administrator.`
                : 'Falhou em autenticar. Verifique usuário e Application Password.'
            }
          />
          <DiagRow
            label="Listar usuários (/users?context=edit)"
            ok={usersAccessOk}
            value={`HTTP ${result.usersListStatus}`}
            detail={result.usersListMessage}
          />
          {result.usersFirstEmail && (
            <DiagRow
              label="Email do primeiro user retornado"
              ok={true}
              value={result.usersFirstEmail}
              detail="✓ Email visível — import vai funcionar"
            />
          )}
        </div>

        {!usersAccessOk && (
          <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-3 text-xs space-y-1">
            <strong className="text-pco-deep">Como resolver:</strong>
            <ol className="list-decimal pl-5 space-y-0.5 text-ink-muted">
              <li>
                Login no WP-Admin de portalpco.online com user que JÁ é
                administrator
              </li>
              <li>
                Ir em <code>Usuários</code>, encontrar{' '}
                <strong>{result.meUser ?? 'o user da conexão'}</strong>
              </li>
              <li>
                Mudar Função (Role) para <strong>Administrator</strong>
              </li>
              <li>Salvar</li>
              <li>
                <strong>
                  Talvez precise gerar nova Application Password depois de mudar
                  role
                </strong>{' '}
                (alguns plugins de segurança invalidam ao trocar role)
              </li>
              <li>Atualizar a senha aqui no AVA PCO e diagnosticar de novo</li>
            </ol>
            <div className="pt-2 text-[10px] text-ink-subtle">
              Plugins comuns que bloqueiam REST API mesmo com admin role:
              Wordfence Security, iThemes Security, WP Cerber. Verifique se
              algum está limitando "REST API authentication" ou exigindo
              whitelist de IP.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagRow({
  label,
  ok,
  value,
  detail,
}: {
  label: string;
  ok: boolean;
  value: string;
  detail: string;
}) {
  return (
    <div
      className={`pco-card p-3 ${
        ok
          ? 'border-status-success/30 bg-status-success/5'
          : 'border-status-danger/30 bg-status-danger/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={ok ? 'text-status-success' : 'text-status-danger'}>
          {ok ? '✓' : '✗'}
        </span>
        <span className="text-sm font-bold text-pco-deep">{label}</span>
        <span className="ml-auto text-[11px] font-mono text-ink-muted">
          {value}
        </span>
      </div>
      <div className="text-[11px] text-ink-muted mt-1">{detail}</div>
    </div>
  );
}

function keyLabel(k: UserMatchKeyDto): string {
  switch (k) {
    case 'email':
      return 'E-mail';
    case 'document':
      return 'CPF / Documento';
    case 'external_id':
      return 'ID externo (refs-store)';
    case 'wp_user_id':
      return 'ID do WordPress';
  }
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="h-7 w-7 rounded-full bg-pco-blue/10 text-pco-blue grid place-items-center text-xs font-bold shrink-0 mt-0.5">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold text-pco-deep">{title}</h2>
          <p className="text-xs text-ink-muted mt-0.5">{description}</p>
        </div>
      </div>
      <div className="pl-10 space-y-2">{children}</div>
    </section>
  );
}

function ConflictOption({
  value,
  current,
  label,
  description,
  onSelect,
}: {
  value: ConflictStrategyDto;
  current: ConflictStrategyDto;
  label: string;
  description: string;
  onSelect: (v: ConflictStrategyDto) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`text-left pco-card p-3 transition-all ${
        active ? 'border-pco-blue/40 bg-pco-blue/5' : 'hover:border-pco-blue/20'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
        <span
          className={`h-3.5 w-3.5 rounded-full border-2 ${
            active ? 'border-pco-blue bg-pco-blue' : 'border-pco-border'
          }`}
        />
        {label}
      </div>
      <div className="text-[11px] text-ink-muted mt-1 ml-6">{description}</div>
    </button>
  );
}

function ConnectionEditor({
  editing,
  onSave,
  onCancel,
}: {
  editing: ImportConnectionDto | null;
  onSave: (input: {
    name: string;
    siteUrl: string;
    wpUsername?: string;
    wpAppPassword?: string;
    wcConsumerKey?: string;
    wcConsumerSecret?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [siteUrl, setSiteUrl] = useState(editing?.siteUrl ?? '');
  const [wpUsername, setWpUsername] = useState(editing?.wpUsername ?? '');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [showWc, setShowWc] = useState(
    Boolean(editing?.hasWcConsumerKey || editing?.hasWcConsumerSecret),
  );
  const [wcConsumerKey, setWcConsumerKey] = useState('');
  const [wcConsumerSecret, setWcConsumerSecret] = useState('');

  useMemo(() => {
    setName(editing?.name ?? '');
    setSiteUrl(editing?.siteUrl ?? '');
    setWpUsername(editing?.wpUsername ?? '');
    setWpAppPassword('');
    setWcConsumerKey('');
    setWcConsumerSecret('');
    setShowWc(Boolean(editing?.hasWcConsumerKey || editing?.hasWcConsumerSecret));
  }, [editing]);

  return (
    <section className="pco-card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.name}` : 'Nova conexão'}
      </h3>

      {/* WP + LD (obrigatório) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`pco-badge text-[10px] ${SOURCE_BADGE.wp}`}>
            WordPress + LearnDash
          </span>
          <span className="text-[11px] text-ink-muted">obrigatório</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Nome da conexão"
            value={name}
            onChange={setName}
            placeholder="Ex: Site origem"
          />
          <Input
            label="Site URL"
            value={siteUrl}
            onChange={setSiteUrl}
            placeholder="https://meusite.com"
          />
          <Input
            label="WP usuário"
            value={wpUsername}
            onChange={setWpUsername}
            placeholder="admin"
          />
          <Input
            label={
              editing?.hasWpAppPassword
                ? 'WP App Password (vazio = manter atual)'
                : 'WP App Password'
            }
            value={wpAppPassword}
            onChange={setWpAppPassword}
            type="password"
            placeholder="abcd 1234 efgh 5678"
          />
        </div>
        <p className="text-[11px] text-ink-subtle">
          Application Password se cria em{' '}
          <code>Usuários → Editar → Application Passwords</code> no WordPress.
          LearnDash usa o mesmo login.
        </p>
      </div>

      <div className="border-t border-pco-border" />

      {/* WC (opcional) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`pco-badge text-[10px] ${SOURCE_BADGE.wc}`}>
              WooCommerce
            </span>
            <span className="text-[11px] text-ink-muted">
              opcional — só se for importar produtos/pedidos
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowWc((v) => !v)}
            className="text-[11px] text-pco-blue hover:underline"
          >
            {showWc ? 'Ocultar' : 'Configurar agora'}
          </button>
        </div>
        {showWc && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={
                  editing?.hasWcConsumerKey
                    ? 'WC Consumer Key (vazio = manter)'
                    : 'WC Consumer Key'
                }
                value={wcConsumerKey}
                onChange={setWcConsumerKey}
                type="password"
                placeholder="ck_..."
              />
              <Input
                label={
                  editing?.hasWcConsumerSecret
                    ? 'WC Consumer Secret (vazio = manter)'
                    : 'WC Consumer Secret'
                }
                value={wcConsumerSecret}
                onChange={setWcConsumerSecret}
                type="password"
                placeholder="cs_..."
              />
            </div>
            <p className="text-[11px] text-ink-subtle">
              Gere as chaves em{' '}
              <code>WooCommerce → Configurações → Avançado → REST API</code>.
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="pco-btn-ghost text-xs">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              name,
              siteUrl,
              wpUsername: wpUsername || undefined,
              wpAppPassword: wpAppPassword || undefined,
              wcConsumerKey: showWc ? wcConsumerKey || undefined : undefined,
              wcConsumerSecret: showWc ? wcConsumerSecret || undefined : undefined,
            })
          }
          className="pco-btn-primary"
          disabled={!name || !siteUrl}
        >
          {editing ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pco-input mt-1 text-sm w-full"
      />
    </label>
  );
}
