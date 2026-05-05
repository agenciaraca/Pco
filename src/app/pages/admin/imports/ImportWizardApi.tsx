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
  EnrollmentExpirationRuleDto,
  EnrollmentStartRuleDto,
  ImportConnectionDto,
  ImportEntityTypeDto,
} from '../../../data/api';

const ALL_ENTITIES: Array<{ id: ImportEntityTypeDto; label: string; hint: string }> = [
  { id: 'student', label: 'Alunos', hint: 'WP /wp-json/wp/v2/users' },
  { id: 'course', label: 'Cursos', hint: 'LD /ldlms/v2/sfwd-courses' },
  { id: 'lesson', label: 'Aulas', hint: 'LD /ldlms/v2/sfwd-lessons' },
  { id: 'topic', label: 'Tópicos', hint: 'LD /ldlms/v2/sfwd-topic' },
  { id: 'quiz', label: 'Quizzes', hint: 'LD /ldlms/v2/sfwd-quiz' },
  { id: 'question', label: 'Questões', hint: 'LD /ldlms/v2/sfwd-question' },
  { id: 'group', label: 'Grupos', hint: 'LD /ldlms/v2/groups' },
  { id: 'product', label: 'Produtos WC', hint: 'WC /wc/v3/products' },
  { id: 'order', label: 'Pedidos WC', hint: 'WC /wc/v3/orders' },
  { id: 'enrollment', label: 'Matrículas', hint: 'LD courses/{id}/users' },
  { id: 'progress', label: 'Progresso', hint: 'LD users/{id}/course-progress' },
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
  const editing = useMemo(
    () => (conns.data ?? []).find((c) => c.id === editingId) ?? null,
    [conns.data, editingId],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entities, setEntities] = useState<ImportEntityTypeDto[]>([
    'student',
    'course',
    'product',
    'order',
    'enrollment',
  ]);
  const [dryRun, setDryRun] = useState(true);
  const [startRule, setStartRule] = useState<EnrollmentStartRuleDto>('paid_date');
  const [expirationRule, setExpirationRule] =
    useState<EnrollmentExpirationRuleDto>('start_plus_duration');
  const [defaultDuration, setDefaultDuration] = useState<number>(365);
  const [userMatchStrategy, setUserMatchStrategy] = useState<
    'email_first' | 'external_id_first' | 'email_only' | 'external_id_only'
  >('email_first');
  const [unmatchedUserPolicy, setUnmatchedUserPolicy] = useState<
    'skip' | 'create_stub' | 'error'
  >('skip');

  function toggleEntity(e: ImportEntityTypeDto) {
    setEntities((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  async function handleStart() {
    if (!selectedId) {
      toast.error('Selecione', 'Escolha uma conexão.');
      return;
    }
    if (entities.length === 0) {
      toast.error('Selecione', 'Marque ao menos uma entidade.');
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
          userMatchStrategy,
          unmatchedUserPolicy,
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
          Importação via API (WP + LD + WC)
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Conecta ao site WordPress origem e puxa alunos, cursos, produtos, pedidos e
          matrículas. Credenciais salvas criptografadas.
        </p>
      </header>

      <ConnectionEditor
        editing={editing}
        onSave={async (input) => {
          try {
            if (editing) {
              await update.mutateAsync({ id: editing.id, input });
              toast.success('Conexão atualizada');
            } else {
              const created = await create.mutateAsync(input);
              setSelectedId(created.id);
              toast.success('Conexão criada');
            }
            setEditingId(null);
          } catch (err) {
            toast.error('Falha', err instanceof Error ? err.message : 'Erro');
          }
        }}
        onCancel={() => setEditingId(null)}
      />

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2">Conexões</h2>
        {conns.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (conns.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhuma conexão. Cadastre acima.
          </div>
        ) : (
          <ul className="space-y-2">
            {(conns.data ?? []).map((c) => (
              <li key={c.id} className="pco-card p-3 flex items-center gap-3 flex-wrap">
                <input
                  type="radio"
                  name="conn"
                  checked={selectedId === c.id}
                  onChange={() => setSelectedId(c.id)}
                  className="accent-pco-blue"
                />
                <div className="flex-1 min-w-[260px]">
                  <div className="text-sm font-semibold text-pco-deep">{c.name}</div>
                  <div className="text-[11px] text-ink-subtle">{c.siteUrl}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    {c.hasWpAppPassword ? 'WP ok' : 'WP sem senha'} ·{' '}
                    {c.hasWcConsumerKey && c.hasWcConsumerSecret ? 'WC ok' : 'WC sem chaves'}
                    {c.lastTestedAt && (
                      <> · último teste: {new Date(c.lastTestedAt).toLocaleString('pt-BR')}</>
                    )}
                  </div>
                  {c.lastTestStatus && (
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
                      {c.lastTestMessage}
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
                      lines.push(`LD: ${r.ld.ok ? 'OK' : 'FALHOU'} — ${r.ld.message}`);
                      if (r.wc.skipped) {
                        lines.push('WC: não configurado (opcional)');
                      } else {
                        lines.push(`WC: ${r.wc.ok ? 'OK' : 'FALHOU'} — ${r.wc.message}`);
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
                  onClick={() => setEditingId(c.id)}
                  className="pco-btn-ghost text-xs"
                >
                  Editar
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pco-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-pco-deep">Entidades a importar</h3>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {ALL_ENTITIES.map((e) => (
            <label
              key={e.id}
              className="flex items-start gap-2 text-xs p-2 rounded border border-pco-border hover:bg-surface-mute cursor-pointer"
            >
              <input
                type="checkbox"
                checked={entities.includes(e.id)}
                onChange={() => toggleEntity(e.id)}
                className="accent-pco-blue mt-0.5"
              />
              <div className="flex-1">
                <div className="font-semibold text-pco-deep">{e.label}</div>
                <div className="text-ink-subtle">{e.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="pco-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-pco-deep">
          Vínculo aluno → matrícula / pedido / progresso
        </h3>
        <p className="text-[11px] text-ink-muted">
          Como o sistema decide a qual aluno interno cada matrícula/pedido/progresso
          pertence. <strong>E-mail</strong> é a chave universal — útil pra consolidar
          alunos vindos de múltiplos sites/fontes.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Estratégia de match
            </span>
            <select
              value={userMatchStrategy}
              onChange={(e) =>
                setUserMatchStrategy(
                  e.target.value as typeof userMatchStrategy,
                )
              }
              className="pco-input mt-1 text-sm"
            >
              <option value="email_first">
                E-mail primeiro, fallback ID externo (recomendado)
              </option>
              <option value="external_id_first">
                ID externo primeiro, fallback e-mail
              </option>
              <option value="email_only">
                Apenas e-mail (consolida cross-source)
              </option>
              <option value="external_id_only">
                Apenas ID externo (mantém fontes separadas)
              </option>
            </select>
          </label>
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
              <option value="create_stub">Criar aluno mínimo com o e-mail</option>
              <option value="error">Marcar como erro</option>
            </select>
          </label>
        </div>
      </section>

      <section className="pco-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-pco-deep">Regras de matrícula</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Data inicial
            </span>
            <select
              value={startRule}
              onChange={(e) => setStartRule(e.target.value as EnrollmentStartRuleDto)}
              className="pco-input mt-1 text-sm"
            >
              <option value="paid_date">Pagamento</option>
              <option value="completed_date">Conclusão pedido</option>
              <option value="order_date">Data pedido</option>
              <option value="imported">CSV</option>
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
      </section>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3 items-start text-xs text-ink-muted">
        <CheckCircle2 size={16} className="text-pco-blue shrink-0 mt-0.5" />
        <div>
          Faça <strong>dry-run primeiro</strong> para revisar volumes e erros antes da
          execução real.
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 flex-wrap">
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
          disabled={startApi.isPending || !selectedId || entities.length === 0}
          className="pco-btn-primary"
        >
          {startApi.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} strokeWidth={2} />
          )}
          {dryRun ? 'Iniciar dry-run' : 'Executar importação real'}
        </button>
      </div>
    </div>
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
  const [wcConsumerKey, setWcConsumerKey] = useState('');
  const [wcConsumerSecret, setWcConsumerSecret] = useState('');

  // Reset when editing changes
  useMemo(() => {
    setName(editing?.name ?? '');
    setSiteUrl(editing?.siteUrl ?? '');
    setWpUsername(editing?.wpUsername ?? '');
    setWpAppPassword('');
    setWcConsumerKey('');
    setWcConsumerSecret('');
  }, [editing]);

  return (
    <section className="pco-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.name}` : 'Nova conexão'}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome" value={name} onChange={setName} placeholder="Ex: site origem" />
        <Input
          label="Site URL"
          value={siteUrl}
          onChange={setSiteUrl}
          placeholder="https://psicanaliseclinica.online"
        />
        <Input label="WP usuário" value={wpUsername} onChange={setWpUsername} />
        <Input
          label={editing?.hasWpAppPassword ? 'WP App Password (deixe vazio = manter)' : 'WP App Password'}
          value={wpAppPassword}
          onChange={setWpAppPassword}
          type="password"
          placeholder="abcd 1234 efgh 5678"
        />
        <Input
          label={editing?.hasWcConsumerKey ? 'WC Consumer Key (vazio = manter)' : 'WC Consumer Key'}
          value={wcConsumerKey}
          onChange={setWcConsumerKey}
          type="password"
        />
        <Input
          label={editing?.hasWcConsumerSecret ? 'WC Consumer Secret (vazio = manter)' : 'WC Consumer Secret'}
          value={wcConsumerSecret}
          onChange={setWcConsumerSecret}
          type="password"
        />
      </div>
      <div className="flex items-center gap-2 justify-end">
        {editing && (
          <button type="button" onClick={onCancel} className="pco-btn-ghost text-xs">
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            onSave({
              name,
              siteUrl,
              wpUsername: wpUsername || undefined,
              wpAppPassword: wpAppPassword || undefined,
              wcConsumerKey: wcConsumerKey || undefined,
              wcConsumerSecret: wcConsumerSecret || undefined,
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
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
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
