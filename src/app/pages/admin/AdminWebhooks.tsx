import { useMemo, useState } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  History as HistoryIcon,
} from 'lucide-react';
import {
  useWebhookEvents,
  useWebhookEndpoints,
  useCreateWebhookEndpoint,
  useUpdateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useTestWebhookEndpoint,
  useWebhookDeliveries,
  useRetryWebhookDelivery,
  useWebhookPresets,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type {
  WebhookEndpointDto,
  WebhookEventTypeDto,
  WebhookDeliveryDto,
} from '../../data/api';

export default function AdminWebhooks() {
  useDocumentMeta({ title: 'Webhooks — Admin AVA PCO' });
  const events = useWebhookEvents();
  const endpoints = useWebhookEndpoints();
  const create = useCreateWebhookEndpoint();
  const update = useUpdateWebhookEndpoint();
  const del = useDeleteWebhookEndpoint();
  const test = useTestWebhookEndpoint();
  const retry = useRetryWebhookDelivery();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(
    () => (endpoints.data ?? []).find((e) => e.id === editingId) ?? null,
    [endpoints.data, editingId],
  );
  const [filterEndpoint, setFilterEndpoint] = useState<string | undefined>();
  const deliveries = useWebhookDeliveries(filterEndpoint);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDeliveryDto | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Webhook size={20} className="text-pco-blue" strokeWidth={1.75} />
          Webhooks de saída
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          O AVA dispara HTTP POST assinados com HMAC-SHA256 quando eventos importantes
          acontecem. Útil para integrar com Zapier, n8n, CRM, ERP, etc.
        </p>
      </header>

      <EndpointEditor
        editing={editing}
        availableEvents={events.data?.events ?? []}
        onSave={async (input) => {
          try {
            if (editing) {
              await update.mutateAsync({ id: editing.id, input });
              toast.success('Endpoint atualizado');
            } else {
              await create.mutateAsync(input);
              toast.success('Endpoint criado');
            }
            setEditingId(null);
          } catch (err) {
            toast.error('Falha', err instanceof Error ? err.message : 'Erro');
          }
        }}
        onCancel={() => setEditingId(null)}
      />

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2">Endpoints</h2>
        {endpoints.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (endpoints.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhum endpoint cadastrado.
          </div>
        ) : (
          <ul className="space-y-2">
            {(endpoints.data ?? []).map((e) => (
              <li key={e.id} className="pco-card p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-pco-deep">{e.name}</span>
                      {e.enabled ? (
                        <span className="pco-badge bg-status-success/10 text-status-success">
                          ativo
                        </span>
                      ) : (
                        <span className="pco-badge bg-surface-gray text-ink-muted">
                          inativo
                        </span>
                      )}
                      {e.hasSecret && (
                        <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                          assinado
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-subtle break-all mt-0.5">
                      {e.url}
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      {e.events.join(', ')}
                    </div>
                    {e.lastErrorMessage && (
                      <div className="text-[11px] mt-0.5 text-status-danger">
                        <AlertCircle size={10} className="inline" /> {e.lastErrorMessage}
                      </div>
                    )}
                    {e.lastSuccessAt && !e.lastErrorMessage && (
                      <div className="text-[11px] mt-0.5 text-status-success">
                        <CheckCircle2 size={10} className="inline" /> Último sucesso:{' '}
                        {new Date(e.lastSuccessAt).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await test.mutateAsync(e.id);
                        toast[r.ok ? 'success' : 'error'](
                          r.ok ? 'Test OK' : 'Falha',
                          r.error ?? `HTTP ${r.status}`,
                        );
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs"
                    disabled={test.isPending}
                  >
                    <Wifi size={11} strokeWidth={2} />
                    Testar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterEndpoint(e.id)}
                    className="pco-btn-ghost text-xs"
                  >
                    <HistoryIcon size={11} strokeWidth={2} />
                    Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(e.id)}
                    className="pco-btn-ghost text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Excluir endpoint ${e.name}?`)) return;
                      try {
                        await del.mutateAsync(e.id);
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
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <HistoryIcon size={16} className="text-pco-blue" strokeWidth={1.75} />
            Entregas {filterEndpoint && '(filtradas)'}
          </h2>
          {filterEndpoint && (
            <button
              type="button"
              onClick={() => setFilterEndpoint(undefined)}
              className="pco-btn-ghost text-xs"
            >
              Limpar filtro
            </button>
          )}
        </div>
        {deliveries.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (deliveries.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhuma entrega ainda.
          </div>
        ) : (
          <div className="pco-card overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Evento</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">HTTP</th>
                  <th className="text-left px-3 py-2 font-medium">Tentativas</th>
                  <th className="text-left px-3 py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {(deliveries.data ?? []).map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDelivery(d)}
                    className="cursor-pointer hover:bg-surface-mute/40"
                  >
                    <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 font-mono">{d.event}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`pco-badge ${
                          d.status === 'success'
                            ? 'bg-status-success/10 text-status-success'
                            : d.status === 'failed'
                              ? 'bg-status-danger/15 text-status-danger'
                              : d.status === 'retrying'
                                ? 'bg-pco-orange/10 text-pco-orange'
                                : 'bg-surface-gray text-ink-muted'
                        }`}
                      >
                        {d.status}
                      </span>
                      {d.lastError && (
                        <div className="text-[10px] text-status-danger mt-0.5 max-w-[260px] truncate">
                          {d.lastError}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">
                      {d.lastResponseStatus ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{d.attempts}</td>
                    <td className="px-3 py-2">
                      {d.status === 'failed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await retry.mutateAsync(d.id);
                              toast.success('Reagendado');
                            } catch (err) {
                              toast.error(
                                'Falha',
                                err instanceof Error ? err.message : 'Erro',
                              );
                            }
                          }}
                          className="pco-btn-ghost text-[11px]"
                        >
                          <RefreshCw size={10} strokeWidth={2} />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedDelivery && (
        <DeliveryDetailDrawer
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onRetry={async () => {
            try {
              await retry.mutateAsync(selectedDelivery.id);
              toast.success('Reagendado');
              setSelectedDelivery(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}
    </div>
  );
}

function DeliveryDetailDrawer({
  delivery,
  onClose,
  onRetry,
}: {
  delivery: WebhookDeliveryDto;
  onClose: () => void;
  onRetry: () => void;
}) {
  const payloadStr = JSON.stringify(delivery.payload, null, 2);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 grid place-items-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl h-full overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-pco-deep">Delivery</h2>
            <code className="text-[10px] text-ink-subtle">{delivery.id}</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pco-btn-ghost text-xs"
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <Field label="Evento" value={delivery.event} mono />
          <Field label="Status" value={delivery.status} />
          <Field
            label="Tentativas"
            value={String(delivery.attempts)}
          />
          <Field
            label="HTTP"
            value={delivery.lastResponseStatus?.toString() ?? '—'}
          />
          <Field
            label="Criada"
            value={new Date(delivery.createdAt).toLocaleString('pt-BR')}
          />
          {delivery.completedAt && (
            <Field
              label="Completou"
              value={new Date(delivery.completedAt).toLocaleString('pt-BR')}
            />
          )}
          {delivery.nextAttemptAt && delivery.status !== 'success' && (
            <Field
              label="Próxima tentativa"
              value={new Date(delivery.nextAttemptAt).toLocaleString('pt-BR')}
            />
          )}
        </div>

        {delivery.lastError && (
          <div className="pco-card border-status-danger/40 bg-status-danger/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-status-danger mb-1">
              Último erro
            </div>
            <pre className="text-xs whitespace-pre-wrap break-all">
              {delivery.lastError}
            </pre>
          </div>
        )}

        <div>
          <h3 className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">
            Payload enviado
          </h3>
          <pre className="bg-surface-mute p-3 rounded text-[10px] font-mono overflow-x-auto max-h-80">
            {payloadStr}
          </pre>
        </div>

        {delivery.lastResponseBody && (
          <div>
            <h3 className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">
              Resposta do destino (truncada)
            </h3>
            <pre className="bg-surface-mute p-3 rounded text-[10px] font-mono overflow-x-auto max-h-60">
              {delivery.lastResponseBody}
            </pre>
          </div>
        )}

        {delivery.status === 'failed' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRetry}
              className="pco-btn-primary text-xs"
            >
              <RefreshCw size={11} strokeWidth={2} />
              Reenviar agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div
        className={`text-pco-deep ${mono ? 'font-mono text-[11px]' : 'font-semibold'}`}
      >
        {value}
      </div>
    </div>
  );
}

function EndpointEditor({
  editing,
  availableEvents,
  onSave,
  onCancel,
}: {
  editing: WebhookEndpointDto | null;
  availableEvents: WebhookEventTypeDto[];
  onSave: (input: {
    name: string;
    url: string;
    events: WebhookEventTypeDto[];
    enabled: boolean;
    channelType: 'generic' | 'slack' | 'discord';
    secret?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [events, setEvents] = useState<WebhookEventTypeDto[]>(editing?.events ?? []);
  const [secret, setSecret] = useState('');
  const [channelType, setChannelType] = useState<'generic' | 'slack' | 'discord'>(
    editing?.channelType ?? 'generic',
  );

  useMemo(() => {
    setName(editing?.name ?? '');
    setUrl(editing?.url ?? '');
    setEnabled(editing?.enabled ?? true);
    setEvents(editing?.events ?? []);
    setSecret('');
    setChannelType(editing?.channelType ?? 'generic');
  }, [editing]);

  function toggleEvent(e: WebhookEventTypeDto) {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  const presetsQ = useWebhookPresets();
  const [presetId, setPresetId] = useState<string>('');

  function applyPreset(id: string) {
    setPresetId(id);
    const p = (presetsQ.data?.presets ?? []).find((x) => x.id === id);
    if (!p) return;
    setName(p.name);
    setChannelType(p.channelType);
    // Eventos sugeridos: filtra os que existem na lista do sistema
    const valid = p.suggestedEvents.filter((e) =>
      availableEvents.includes(e as WebhookEventTypeDto),
    ) as WebhookEventTypeDto[];
    setEvents(valid);
    // Não preencher URL — o admin precisa colar o link real
  }

  return (
    <section className="pco-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.name}` : 'Novo endpoint'}
      </h2>

      {!editing && (presetsQ.data?.presets.length ?? 0) > 0 && (
        <div className="bg-pco-blue/5 border border-pco-blue/30 rounded-lg p-3 space-y-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-pco-blue font-semibold">
              Preset (opcional)
            </span>
            <select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="pco-input mt-1 text-sm w-full"
            >
              <option value="">— Configurar manualmente —</option>
              {presetsQ.data?.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon ?? ''} {p.name} — {p.description.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          {presetId &&
            (() => {
              const p = presetsQ.data?.presets.find((x) => x.id === presetId);
              if (!p) return null;
              return (
                <div className="text-xs text-ink-muted space-y-1">
                  <div>
                    <strong>Cole no campo URL:</strong>{' '}
                    <code className="bg-white px-1 py-0.5 rounded text-[10px]">
                      {p.urlPlaceholder}
                    </code>
                  </div>
                  {p.notes && <div>💡 {p.notes}</div>}
                  {p.docsUrl && (
                    <div>
                      📖{' '}
                      <a
                        href={p.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pco-blue hover:underline"
                      >
                        Documentação oficial
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome" value={name} onChange={setName} placeholder="Ex: Zapier produção" />
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Tipo de canal
          </span>
          <select
            value={channelType}
            onChange={(e) =>
              setChannelType(e.target.value as 'generic' | 'slack' | 'discord')
            }
            className="pco-input mt-1 text-sm w-full"
          >
            <option value="generic">Genérico (JSON cru, com HMAC)</option>
            <option value="slack">Slack (incoming webhook)</option>
            <option value="discord">Discord (webhook URL)</option>
          </select>
        </label>
        <Input
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder={
            channelType === 'slack'
              ? 'https://hooks.slack.com/services/...'
              : channelType === 'discord'
                ? 'https://discord.com/api/webhooks/...'
                : 'https://meu-app.com/webhook'
          }
        />
        {channelType === 'generic' && (
          <Input
            label={editing?.hasSecret ? 'Secret HMAC (vazio = manter)' : 'Secret HMAC (opcional)'}
            value={secret}
            onChange={setSecret}
            type="password"
            placeholder="whsec_..."
          />
        )}
        <label className="flex items-center gap-2 mt-5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-pco-blue"
          />
          <span className="text-sm">Habilitado</span>
        </label>
      </div>
      <div>
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">
          Eventos a assinar
        </span>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 mt-1">
          {availableEvents.map((e) => (
            <label
              key={e}
              className="flex items-center gap-2 text-xs p-2 rounded border border-pco-border hover:bg-surface-mute cursor-pointer"
            >
              <input
                type="checkbox"
                checked={events.includes(e)}
                onChange={() => toggleEvent(e)}
                className="accent-pco-blue"
              />
              <code>{e}</code>
            </label>
          ))}
        </div>
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
              url,
              events,
              enabled,
              channelType,
              secret: secret || undefined,
            })
          }
          disabled={!name || !url || events.length === 0}
          className="pco-btn-primary"
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
