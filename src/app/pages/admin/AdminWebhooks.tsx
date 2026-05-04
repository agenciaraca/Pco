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
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { WebhookEndpointDto, WebhookEventTypeDto } from '../../data/api';

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
                  <tr key={d.id}>
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
    secret?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [events, setEvents] = useState<WebhookEventTypeDto[]>(editing?.events ?? []);
  const [secret, setSecret] = useState('');

  useMemo(() => {
    setName(editing?.name ?? '');
    setUrl(editing?.url ?? '');
    setEnabled(editing?.enabled ?? true);
    setEvents(editing?.events ?? []);
    setSecret('');
  }, [editing]);

  function toggleEvent(e: WebhookEventTypeDto) {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  return (
    <section className="pco-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.name}` : 'Novo endpoint'}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome" value={name} onChange={setName} placeholder="Ex: Zapier produção" />
        <Input
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://hooks.zapier.com/..."
        />
        <Input
          label={editing?.hasSecret ? 'Secret HMAC (vazio = manter)' : 'Secret HMAC (opcional)'}
          value={secret}
          onChange={setSecret}
          type="password"
          placeholder="whsec_..."
        />
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
