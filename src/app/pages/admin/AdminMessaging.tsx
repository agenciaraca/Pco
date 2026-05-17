import { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
} from 'lucide-react';
import {
  useMessagingConfigs,
  useCreateMessagingConfig,
  useUpdateMessagingConfig,
  useDeleteMessagingConfig,
} from '../../data/hooks';
import * as api from '../../data/api';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

const PROVIDER_LABELS: Record<api.MessagingProviderId, string> = {
  mock: 'Mock (dev/teste)',
  twilio: 'Twilio (SMS)',
  'whatsapp-meta': 'WhatsApp Cloud API (Meta)',
};

export default function AdminMessaging() {
  useDocumentMeta({ title: 'Mensageria — Admin AVA PCO' });
  const toast = useToast();
  const configsQ = useMessagingConfigs();
  const createMut = useCreateMessagingConfig();
  const updateMut = useUpdateMessagingConfig();
  const deleteMut = useDeleteMessagingConfig();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<api.MessagingConfigView | null>(
    null,
  );
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const [testBody, setTestBody] = useState<Record<string, string>>({});
  const [testTemplate, setTestTemplate] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await updateMut.mutateAsync({ id, patch: { enabled } });
      toast.success(enabled ? 'Habilitado' : 'Desabilitado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handlePing(id: string) {
    setBusy((b) => ({ ...b, [`ping-${id}`]: true }));
    try {
      const r = await api.pingMessagingConfig(id);
      if (r.ok) toast.success('Conexão OK', r.message);
      else toast.error('Ping falhou', r.message);
      void configsQ.refetch();
    } catch (err) {
      toast.error('Erro no ping', err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy((b) => ({ ...b, [`ping-${id}`]: false }));
    }
  }

  async function handleTest(id: string) {
    const to = testTo[id]?.trim();
    const body = testBody[id]?.trim();
    const tpl = testTemplate[id]?.trim();
    if (!to || !/^\+\d{8,15}$/.test(to)) {
      toast.error('Telefone inválido', 'Use formato internacional E.164: +5511999999999');
      return;
    }
    if (!body && !tpl) {
      toast.error('Conteúdo vazio', 'Digite uma mensagem ou nome de template');
      return;
    }
    setBusy((b) => ({ ...b, [`test-${id}`]: true }));
    try {
      const r = await api.testSendMessage(id, { to, body, whatsappTemplate: tpl || undefined });
      if (r.ok) toast.success('Mensagem enviada', `Confira ${to}`);
      else toast.error('Falha no envio', r.error?.message ?? 'Erro');
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy((b) => ({ ...b, [`test-${id}`]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Mensageria</h1>
          <p className="pco-section-subtitle mt-1">
            SMS via Twilio e WhatsApp Cloud API (Meta). Configure providers,
            ative o desejado, faça ping e envie mensagem de teste.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo provider
        </button>
      </header>

      <div className="pco-card bg-pco-cyan/5 border-pco-cyan/30">
        <h3 className="text-sm font-semibold text-pco-deep mb-2 inline-flex items-center gap-2">
          <MessageSquare size={14} className="text-pco-blue" />
          Como configurar WhatsApp Cloud API (Meta)
        </h3>
        <ol className="text-xs text-ink-muted list-decimal list-inside space-y-1.5 leading-relaxed">
          <li>
            Crie uma conta em{' '}
            <a
              href="https://developers.facebook.com"
              target="_blank"
              rel="noreferrer"
              className="text-pco-blue underline"
            >
              developers.facebook.com
            </a>{' '}
            e adicione um app tipo <strong>Business</strong>
          </li>
          <li>
            No app, adicione o produto <strong>WhatsApp</strong>. A Meta dá um
            número de teste grátis + 1000 conversas/mês iniciadas pela empresa
          </li>
          <li>
            Copie <code className="px-1 bg-surface-gray rounded">Phone number ID</code>{' '}
            (numérico, ex: 109123456789012) e gere um{' '}
            <code className="px-1 bg-surface-gray rounded">Permanent access token</code>{' '}
            (em "System users" do Business Manager)
          </li>
          <li>
            Aqui embaixo, "Novo provider" → WhatsApp Cloud → cole token em{' '}
            <em>API key</em> e Phone Number ID
          </li>
          <li>
            <strong>Para usar com clientes reais</strong>: cadastre seu número
            corporativo e crie/aprove templates em "Message templates" (Meta exige
            template para iniciar conversa)
          </li>
        </ol>
      </div>

      {configsQ.isLoading ? (
        <CardListSkeleton count={2} />
      ) : !configsQ.data || configsQ.data.length === 0 ? (
        <div className="pco-card">
          <EmptyState
            icon={<MessageSquare size={26} className="text-pco-blue" strokeWidth={1.5} />}
            title="Nenhum provider configurado"
            description="Clique em 'Novo provider' acima e cadastre Twilio ou WhatsApp Cloud."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {configsQ.data.map((cfg) => (
            <div key={cfg.id} className="pco-card">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-pco-deep">
                      {PROVIDER_LABELS[cfg.provider]}
                    </h3>
                    {cfg.enabled ? (
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        Ativo
                      </span>
                    ) : (
                      <span className="pco-badge bg-surface-gray text-ink-muted">
                        Desativado
                      </span>
                    )}
                    {cfg.lastTestStatus === 'ok' && (
                      <span className="pco-badge bg-pco-blue/10 text-pco-blue inline-flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Ping OK
                      </span>
                    )}
                    {cfg.lastTestStatus === 'error' && (
                      <span className="pco-badge bg-status-danger/15 text-status-danger inline-flex items-center gap-1">
                        <AlertCircle size={10} />
                        Ping falhou
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted">
                    De: <strong className="text-pco-deep font-mono">{cfg.fromNumber}</strong>
                    {cfg.whatsappPhoneNumberId && (
                      <>
                        {' · '}Phone ID:{' '}
                        <span className="font-mono">{cfg.whatsappPhoneNumberId}</span>
                      </>
                    )}
                  </div>
                  {cfg.lastTestMessage && (
                    <div className="text-[11px] text-ink-subtle mt-1">
                      Último teste: {cfg.lastTestMessage}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink-muted inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={(e) => handleToggle(cfg.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-pco-blue"
                    />
                    Habilitado
                  </label>
                  <button
                    onClick={() => setEditingId(cfg.id)}
                    className="pco-btn-ghost text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(cfg)}
                    className="pco-btn-ghost text-xs text-status-danger"
                  >
                    <Trash2 size={11} strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 pt-3 border-t border-surface-gray">
                <button
                  type="button"
                  onClick={() => handlePing(cfg.id)}
                  disabled={busy[`ping-${cfg.id}`]}
                  className="pco-btn-secondary text-xs justify-center"
                >
                  {busy[`ping-${cfg.id}`] ? (
                    <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} strokeWidth={2} />
                  )}
                  Testar conexão (ping)
                </button>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={testTo[cfg.id] ?? ''}
                    onChange={(e) =>
                      setTestTo((t) => ({ ...t, [cfg.id]: e.target.value }))
                    }
                    className="pco-input text-xs"
                    placeholder="+5511999999999"
                  />
                  <input
                    type="text"
                    value={testBody[cfg.id] ?? ''}
                    onChange={(e) =>
                      setTestBody((t) => ({ ...t, [cfg.id]: e.target.value }))
                    }
                    className="pco-input text-xs"
                    placeholder={
                      cfg.provider === 'whatsapp-meta'
                        ? 'Mensagem (só funciona em conversa aberta)'
                        : 'Mensagem do SMS'
                    }
                  />
                  {cfg.provider === 'whatsapp-meta' && (
                    <input
                      type="text"
                      value={testTemplate[cfg.id] ?? ''}
                      onChange={(e) =>
                        setTestTemplate((t) => ({ ...t, [cfg.id]: e.target.value }))
                      }
                      className="pco-input text-xs font-mono"
                      placeholder="ou template aprovado (ex: hello_world)"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleTest(cfg.id)}
                    disabled={busy[`test-${cfg.id}`]}
                    className="pco-btn-secondary text-xs w-full justify-center"
                  >
                    {busy[`test-${cfg.id}`] ? (
                      <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <Send size={12} strokeWidth={2} />
                    )}
                    Enviar mensagem de teste
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editingId) && (
        <MessagingConfigEditor
          config={
            editingId
              ? configsQ.data?.find((c) => c.id === editingId) ?? null
              : null
          }
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => {
            setShowCreate(false);
            setEditingId(null);
          }}
          onSubmit={async (input) => {
            try {
              if (editingId) {
                await updateMut.mutateAsync({ id: editingId, patch: input });
                toast.success('Atualizado');
              } else {
                await createMut.mutateAsync(input);
                toast.success('Provider criado');
              }
              setShowCreate(false);
              setEditingId(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir provider?"
        description={
          confirmDelete && (
            <>
              Remover <strong>{PROVIDER_LABELS[confirmDelete.provider]}</strong>?
              Mensagens em andamento podem falhar.
            </>
          )
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteMut.mutateAsync(confirmDelete.id);
            toast.success('Excluído');
            setConfirmDelete(null);
          } catch (err) {
            toast.error('Falha', err instanceof Error ? err.message : 'Erro');
          }
        }}
      />
    </div>
  );
}

function MessagingConfigEditor({
  config,
  submitting,
  onClose,
  onSubmit,
}: {
  config: api.MessagingConfigView | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: api.MessagingConfigInput) => Promise<void>;
}) {
  const isNew = !config;
  const [provider, setProvider] = useState<api.MessagingProviderId>(
    config?.provider ?? 'whatsapp-meta',
  );
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [fromNumber, setFromNumber] = useState(config?.fromNumber ?? '');
  const [apiKey, setApiKey] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState(
    config?.whatsappPhoneNumberId ?? '',
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
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              {isNew ? 'Novo' : 'Editar'}
            </div>
            <h2 className="text-lg font-bold text-pco-deep">
              {isNew ? 'Provider de mensageria' : 'Editar provider'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">Provider</div>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as api.MessagingProviderId)}
              className="pco-input"
              disabled={!isNew}
            >
              <option value="whatsapp-meta">WhatsApp Cloud API (Meta) — recomendado</option>
              <option value="twilio">Twilio (SMS)</option>
              <option value="mock">Mock (apenas log, sem envio real)</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Número/sender (E.164 ou nome)
            </div>
            <input
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              className="pco-input font-mono text-sm"
              placeholder={
                provider === 'whatsapp-meta'
                  ? '+5511999999999 (seu número WhatsApp business)'
                  : provider === 'twilio'
                    ? '+15005550006 (Twilio número)'
                    : 'AVA-PCO'
              }
              maxLength={32}
            />
          </label>

          {provider === 'whatsapp-meta' && (
            <label className="block">
              <div className="text-xs font-medium text-ink-muted mb-1.5">
                Phone Number ID (Meta){' '}
                <span className="text-ink-subtle">— número longo do app</span>
              </div>
              <input
                type="text"
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                className="pco-input font-mono text-sm"
                placeholder="109123456789012"
                maxLength={32}
              />
            </label>
          )}

          {provider === 'twilio' && (
            <label className="block">
              <div className="text-xs font-medium text-ink-muted mb-1.5">
                Account SID (Twilio)
                {config?.hasAccountSid && (
                  <span className="ml-2 text-status-success">✓ já salvo</span>
                )}
              </div>
              <input
                type="text"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="pco-input font-mono text-xs"
                placeholder={
                  config?.hasAccountSid
                    ? 'Deixe vazio pra manter o atual'
                    : 'ACxxxxxxxx...'
                }
                maxLength={50}
              />
            </label>
          )}

          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              {provider === 'whatsapp-meta'
                ? 'Permanent Access Token (Meta)'
                : provider === 'twilio'
                  ? 'Auth Token (Twilio)'
                  : 'API key'}
              {config?.hasApiKey && (
                <span className="ml-2 text-status-success">✓ já salvo</span>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pco-input font-mono text-xs"
              placeholder={
                config?.hasApiKey ? 'Deixe vazio pra manter o atual' : 'Cole aqui'
              }
              maxLength={500}
            />
            <p className="text-[10px] text-ink-subtle mt-1">
              Criptografado em AES-GCM 256 antes de gravar.
            </p>
          </label>

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded text-pco-blue"
            />
            Habilitar imediatamente
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
                  provider,
                  enabled,
                  fromNumber: fromNumber.trim(),
                  apiKey: apiKey || undefined,
                  accountSid: accountSid || undefined,
                  whatsappPhoneNumberId: whatsappPhoneNumberId.trim() || undefined,
                })
              }
              disabled={submitting || !fromNumber.trim()}
              className="pco-btn-primary text-xs"
            >
              {submitting ? (
                <Loader2 size={12} strokeWidth={2} className="animate-spin" />
              ) : (
                <Save size={12} strokeWidth={2} />
              )}
              {isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
