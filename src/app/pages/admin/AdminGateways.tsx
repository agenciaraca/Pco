import { useState } from 'react';
import {
  CreditCard,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
  Power,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Wifi,
} from 'lucide-react';
import {
  usePaymentProviders,
  usePaymentGateways,
  useCreatePaymentGateway,
  useUpdatePaymentGateway,
  useDeletePaymentGateway,
  useTestPaymentGateway,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { PaymentGatewayDto, PaymentProviderId } from '../../data/api';
import { useT } from '../../i18n';

export default function AdminGateways() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.gateways')} — Admin AVA PCO` });
  const providersQ = usePaymentProviders();
  const gatewaysQ = usePaymentGateways();
  const createMut = useCreatePaymentGateway();
  const updateMut = useUpdatePaymentGateway();
  const deleteMut = useDeletePaymentGateway();
  const testMut = useTestPaymentGateway();
  const toast = useToast();

  const [editing, setEditing] = useState<PaymentGatewayDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PaymentGatewayDto | null>(null);

  const gateways = gatewaysQ.data ?? [];

  async function handleToggleActive(g: PaymentGatewayDto) {
    try {
      await updateMut.mutateAsync({ id: g.id, patch: { active: !g.active } });
      toast.success(g.active ? 'Gateway desativado' : 'Gateway ativado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleTest(g: PaymentGatewayDto) {
    try {
      const r = await testMut.mutateAsync(g.id);
      if (r.ok) toast.success('Conexão OK', r.message);
      // Gateway que respondeu recusando a chave é problema no painel dele;
      // gateway que não respondeu é problema de rede. A mensagem já separa os
      // dois, e o título não pode achatar isso em "falhou".
      else if (r.alcancou) toast.error('Credencial recusada', r.message);
      else toast.error('Sem resposta do gateway', r.message);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Gateway removido');
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep">{t('admin.nav.gateways')}</h1>
          <p className="text-sm text-ink-muted">
            Configure provedores de pagamento. Apenas o gateway ativo é usado para checkouts
            novos. Credenciais são encriptadas em disco.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo gateway
        </button>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3 items-start text-xs text-ink-muted">
        <AlertCircle size={14} strokeWidth={1.75} className="text-pco-orange mt-0.5 shrink-0" />
        <div>
          <p className="text-pco-deep font-semibold mb-0.5">Modo de operação</p>
          <p>
            Apenas o gateway <strong>ativo</strong> é usado em checkouts novos. Use{' '}
            <strong>Testar</strong> antes de ativar um: ele consulta o gateway de verdade, com a
            credencial gravada, <strong>sem cobrar ninguém</strong>. Credencial que deixa de valer
            não avisa — o sintoma é venda paga que não vira matrícula.
          </p>
        </div>
      </div>

      {gatewaysQ.isLoading ? (
        <CardListSkeleton count={3} />
      ) : gatewaysQ.isError ? (
        <ErrorState
          action={
            <button onClick={() => gatewaysQ.refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : gateways.length === 0 ? (
        <EmptyState
          title="Nenhum gateway configurado"
          description="Adicione um para começar a aceitar pagamentos. Use o Sandbox para testar."
        />
      ) : (
        <ul className="space-y-3">
          {gateways.map((g) => {
            const providerInfo = providersQ.data?.find((p) => p.id === g.provider);
            return (
              <li key={g.id} className="pco-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-pco-blue/10 grid place-items-center shrink-0">
                      <CreditCard size={16} className="text-pco-blue" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-pco-deep">
                          {g.displayName}
                        </span>
                        <span className="pco-badge bg-surface-mute text-ink-muted">
                          {providerInfo?.label ?? g.provider}
                        </span>
                        <span
                          className={
                            g.mode === 'live'
                              ? 'pco-badge bg-status-success/10 text-status-success'
                              : 'pco-badge bg-pco-orange/10 text-pco-orange'
                          }
                        >
                          {g.mode === 'live' ? 'LIVE' : 'TEST'}
                        </span>
                        {g.active ? (
                          <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                            Ativo
                          </span>
                        ) : (
                          <span className="pco-badge bg-surface-gray text-ink-muted">
                            Inativo
                          </span>
                        )}
                        {providerInfo && !providerInfo.implemented && (
                          <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                            SDK pendente
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-ink-subtle">
                        API key: {g.hasApiKey ? '✓ configurada' : '— vazia'}
                        {' · '}
                        secret: {g.hasApiSecret ? '✓' : '—'}
                        {' · '}
                        webhook: {g.hasWebhookSecret ? '✓' : '—'}
                        {g.publicKey ? ` · public: ${g.publicKey.slice(0, 16)}...` : ''}
                      </div>
                      {g.lastTestStatus && (
                        <div
                          className={`mt-0.5 text-xs ${
                            g.lastTestStatus === 'ok' ? 'text-status-success' : 'text-status-danger'
                          }`}
                        >
                          {g.lastTestStatus === 'ok' ? (
                            <CheckCircle2 size={10} className="inline" />
                          ) : (
                            <AlertCircle size={10} className="inline" />
                          )}{' '}
                          {g.lastTestMessage}
                          {g.lastTestedAt && (
                            <span className="text-ink-subtle">
                              {' · '}
                              {new Date(g.lastTestedAt).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTest(g)}
                      disabled={testMut.isPending}
                      className="pco-btn-ghost text-xs px-2.5"
                      title="Testar conexão — só leitura, não cobra ninguém"
                    >
                      {testMut.isPending && testMut.variables === g.id ? (
                        <Loader2 size={12} strokeWidth={1.75} className="animate-spin" />
                      ) : (
                        <Wifi size={12} strokeWidth={1.75} />
                      )}
                      Testar
                    </button>
                    <button
                      onClick={() => handleToggleActive(g)}
                      className="pco-btn-ghost text-xs px-2.5"
                      title={g.active ? 'Desativar' : 'Ativar'}
                    >
                      <Power
                        size={12}
                        strokeWidth={1.75}
                        className={g.active ? 'text-status-success' : 'text-ink-muted'}
                      />
                    </button>
                    <button
                      onClick={() => setEditing(g)}
                      className="pco-btn-ghost text-xs px-2.5"
                      title="Editar"
                    >
                      <Edit3 size={12} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(g)}
                      className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                      title="Excluir"
                    >
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <GatewayEditor
          editing={editing}
          providers={providersQ.data ?? []}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            try {
              if (editing) {
                await updateMut.mutateAsync({ id: editing.id, patch: input });
                toast.success('Gateway atualizado');
              } else {
                await createMut.mutateAsync(input as Parameters<typeof createMut.mutateAsync>[0]);
                toast.success('Gateway criado');
              }
              setCreating(false);
              setEditing(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir gateway?"
        description={
          confirmDelete && (
            <>
              <strong>{confirmDelete.displayName}</strong> e todas suas credenciais serão
              removidos. Pedidos existentes vinculados continuam visíveis.
            </>
          )
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

interface EditorProps {
  editing: PaymentGatewayDto | null;
  providers: Array<{ id: PaymentProviderId; label: string; implemented: boolean }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    provider: PaymentProviderId;
    displayName: string;
    mode: 'test' | 'live';
    active: boolean;
    apiKey: string;
    apiSecret?: string;
    webhookSecret?: string;
    publicKey?: string;
  }) => Promise<void>;
}

function GatewayEditor({ editing, providers, submitting, onClose, onSubmit }: EditorProps) {
  const [provider, setProvider] = useState<PaymentProviderId>(editing?.provider ?? 'mock');
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '');
  const [mode, setMode] = useState<'test' | 'live'>(editing?.mode ?? 'test');
  const [active, setActive] = useState(editing?.active ?? true);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [publicKey, setPublicKey] = useState(editing?.publicKey ?? '');
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * A Sandra precisa de duas coisas que não são credencial: o endereço da
   * instalação e o slug da escola. Sem elas o provider recusa antes de chamar —
   * e sem campo aqui, o gateway seria cadastrável e inútil.
   */
  const opcoes = (editing?.options ?? {}) as { baseUrl?: string; tenantSlug?: string };
  const [sandraBaseUrl, setSandraBaseUrl] = useState(opcoes.baseUrl ?? 'https://app.sandra.com.vc');
  const [sandraSlug, setSandraSlug] = useState(opcoes.tenantSlug ?? '');
  const [sandraMetodo, setSandraMetodo] = useState<string>(
    (editing?.options as { metodo?: string })?.metodo ?? 'pix',
  );

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
              Gateway
            </div>
            <h2 className="text-lg font-bold text-pco-deep">
              {editing ? 'Editar gateway' : 'Novo gateway'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (displayName.trim().length < 2) {
              setError('Informe um nome.');
              return;
            }
            if (!editing && !apiKey.trim()) {
              setError('API key obrigatória ao criar.');
              return;
            }
            if (provider === 'sandra' && (!sandraBaseUrl.trim() || !sandraSlug.trim())) {
              setError('Sandra: informe o endereço e o slug da escola.');
              return;
            }
            void onSubmit({
              provider,
              displayName: displayName.trim(),
              mode,
              active,
              apiKey: apiKey.trim(),
              apiSecret: apiSecret.trim() || undefined,
              webhookSecret: webhookSecret.trim() || undefined,
              publicKey: publicKey.trim() || undefined,
              ...(provider === 'sandra'
                ? {
                    options: {
                      baseUrl: sandraBaseUrl.trim(),
                      tenantSlug: sandraSlug.trim(),
                      metodo: sandraMetodo,
                    },
                  }
                : {}),
            });
          }}
          className="p-6 space-y-4"
          noValidate
        >
          <Field label="Provedor">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as PaymentProviderId)}
              disabled={!!editing}
              className="pco-input"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.implemented ? '' : ' (SDK pendente)'}
                </option>
              ))}
            </select>
          </Field>

          {provider === 'sandra' && (
            <div className="rounded-xl border border-pco-blue/25 bg-pco-blue/5 p-4 space-y-3">
              <p className="text-xs text-ink-muted">
                Na Sandra, a cobrança é emitida no gateway da <strong>própria escola</strong> — o
                dinheiro não passa por ela. Além da chave de API, ela precisa saber onde está
                instalada e qual é a escola.
              </p>
              <Field label="Endereço da Sandra" hint="Ex.: https://app.sandra.com.vc">
                <input
                  type="url"
                  value={sandraBaseUrl}
                  onChange={(e) => setSandraBaseUrl(e.target.value)}
                  placeholder="https://app.sandra.com.vc"
                  className="pco-input"
                />
              </Field>
              <Field label="Slug da escola" hint="O identificador da escola dentro da Sandra">
                <input
                  type="text"
                  value={sandraSlug}
                  onChange={(e) => setSandraSlug(e.target.value)}
                  placeholder="pco"
                  className="pco-input font-mono"
                />
              </Field>
              <Field label="Forma de cobrança" hint="A Sandra não tem padrão — escolha uma.">
                <select
                  value={sandraMetodo}
                  onChange={(e) => setSandraMetodo(e.target.value)}
                  className="pco-input"
                >
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="credit">Cartão de crédito</option>
                  <option value="debit">Cartão de débito</option>
                </select>
              </Field>
              <p className="text-xs text-ink-subtle">
                A chave de API precisa do escopo <code>charges:write</code>, e no servidor da Sandra
                a variável <code>PUBLIC_CHARGES</code> tem de estar ligada — em <code>off</code> a
                rota responde 404. Enquanto ela não avisa o pagamento, quem confirma é a varredura
                <code>sandra-poll</code>, em /admin/jobs.
              </p>
            </div>
          )}

          <Field label="Nome para exibir">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Stripe Brasil"
              className="pco-input"
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Modo">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'test' | 'live')}
                className="pco-input"
              >
                <option value="test">Teste (sandbox)</option>
                <option value="live">Produção</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={active ? '1' : '0'}
                onChange={(e) => setActive(e.target.value === '1')}
                className="pco-input"
              >
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-surface-mute pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-pco-deep">Credenciais</h3>
              <button
                type="button"
                onClick={() => setShowSecrets((v) => !v)}
                className="pco-btn-ghost text-xs"
              >
                {showSecrets ? <EyeOff size={11} /> : <Eye size={11} />}
                {showSecrets ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            <Field
              label="API key (secret)"
              hint={editing ? 'Deixe vazio para manter a atual' : 'Obrigatória'}
            >
              <input
                type={showSecrets ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editing ? '••••••••' : 'sk_test_... / asaas_... etc.'}
                className="pco-input font-mono text-xs"
                autoComplete="off"
              />
            </Field>

            <Field label="API secret (opcional)" hint="Para providers que usam par key+secret">
              <input
                type={showSecrets ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="pco-input font-mono text-xs"
                autoComplete="off"
              />
            </Field>

            <Field label="Webhook secret (opcional)">
              <input
                type={showSecrets ? 'text' : 'password'}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="pco-input font-mono text-xs"
                autoComplete="off"
              />
            </Field>

            <Field label="Public key (opcional)" hint="Stripe pk_..., MP public_key, etc.">
              <input
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="pco-input font-mono text-xs"
                autoComplete="off"
              />
            </Field>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
            <button
              type="button"
              onClick={onClose}
              className="pco-btn-ghost text-xs"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editing ? 'Salvar' : 'Criar gateway'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium text-ink-muted mb-1.5">
        {label}
        {hint && <span className="ml-1 text-xs text-ink-subtle">· {hint}</span>}
      </div>
      {children}
    </label>
  );
}
