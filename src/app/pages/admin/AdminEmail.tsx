import { useMemo, useState } from 'react';
import {
  Mail,
  Plus,
  Send,
  Wifi,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  History as HistoryIcon,
} from 'lucide-react';
import {
  useEmailProviders,
  useEmailConfigs,
  useCreateEmailConfig,
  useUpdateEmailConfig,
  useDeleteEmailConfig,
  useTestEmailConfig,
  useSendTestEmail,
  useEmailLogs,
  useEmailTemplates,
  usePreviewEmailTemplate,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { EmailConfigDto, EmailProviderIdDto } from '../../data/api';

const PROVIDER_DESCRIPTION: Record<EmailProviderIdDto, string> = {
  mock: 'Apenas log (dev/teste)',
  resend: 'Resend.com (recomendado, simples)',
  sendgrid: 'SendGrid v3',
  postmark: 'Postmark (server token)',
  smtp: 'SMTP (em breve — use Resend/SendGrid/Postmark)',
};

const TEMPLATE_LABELS: Record<string, string> = {
  password_reset: 'Reset de senha',
  order_paid: 'Pagamento confirmado',
  course_enrolled: 'Matrícula no curso',
  welcome: 'Boas-vindas',
};

export default function AdminEmail() {
  useDocumentMeta({ title: 'E-mail transacional — Admin AVA PCO' });
  const providers = useEmailProviders();
  const configs = useEmailConfigs();
  const create = useCreateEmailConfig();
  const update = useUpdateEmailConfig();
  const del = useDeleteEmailConfig();
  const test = useTestEmailConfig();
  const sendTest = useSendTestEmail();
  const logs = useEmailLogs();
  const templates = useEmailTemplates();
  const toast = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(
    () => (configs.data ?? []).find((c) => c.id === editingId) ?? null,
    [configs.data, editingId],
  );

  const [previewName, setPreviewName] = useState<string | undefined>();
  const preview = usePreviewEmailTemplate(previewName);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Mail size={20} className="text-pco-blue" strokeWidth={1.75} />
          E-mail transacional
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Configure provedor de e-mail. O AVA usa para confirmações de pagamento, reset de
          senha e matrículas. Credenciais salvas criptografadas.
        </p>
      </header>

      <ConfigEditor
        editing={editing}
        providers={providers.data?.providers ?? []}
        onSave={async (input) => {
          try {
            if (editing) {
              await update.mutateAsync({ id: editing.id, input });
              toast.success('Configuração atualizada');
            } else {
              await create.mutateAsync(input);
              toast.success('Configuração criada');
            }
            setEditingId(null);
          } catch (err) {
            toast.error('Falha', err instanceof Error ? err.message : 'Erro');
          }
        }}
        onCancel={() => setEditingId(null)}
      />

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2">Configurações</h2>
        {configs.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (configs.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhuma configuração ainda. Cadastre acima.
          </div>
        ) : (
          <ul className="space-y-2">
            {(configs.data ?? []).map((c) => (
              <li key={c.id} className="pco-card p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-pco-deep">
                        {c.fromName ?? c.fromEmail}
                      </span>
                      <span className="pco-badge bg-pco-cyan/10 text-pco-cyan">
                        {c.provider}
                      </span>
                      {c.enabled ? (
                        <span className="pco-badge bg-status-success/10 text-status-success">
                          ativo
                        </span>
                      ) : (
                        <span className="pco-badge bg-surface-gray text-ink-muted">
                          inativo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-subtle mt-0.5">
                      {c.fromEmail}
                      {c.replyToEmail && <> · reply: {c.replyToEmail}</>}
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
                        toast[r.ok ? 'success' : 'error'](
                          r.ok ? 'Conexão OK' : 'Falha',
                          r.message,
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
                    Teste conexão
                  </button>
                  <SendTestButton
                    onSend={async (to) => {
                      try {
                        await sendTest.mutateAsync({ id: c.id, to });
                        toast.success('E-mail enviado', `para ${to}`);
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                  />
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
                      if (!confirm(`Excluir configuração ${c.fromEmail}?`)) return;
                      try {
                        await del.mutateAsync(c.id);
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
      </section>

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2 flex items-center gap-2">
          <Eye size={16} className="text-pco-blue" strokeWidth={1.75} />
          Preview de templates
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {(templates.data?.names ?? []).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPreviewName(n)}
              className={
                previewName === n
                  ? 'pco-btn-secondary text-xs'
                  : 'pco-btn-ghost text-xs'
              }
            >
              {TEMPLATE_LABELS[n] ?? n}
            </button>
          ))}
        </div>
        {previewName && preview.data && (
          <div className="pco-card overflow-hidden">
            <div className="px-3 py-2 border-b border-pco-border bg-surface-mute text-xs">
              <strong>Assunto:</strong> {preview.data.subject}
            </div>
            <iframe
              title={`preview-${previewName}`}
              srcDoc={preview.data.html}
              className="w-full h-96 bg-white"
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2 flex items-center gap-2">
          <HistoryIcon size={16} className="text-pco-blue" strokeWidth={1.75} />
          Histórico de envios
        </h2>
        {logs.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (logs.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhum envio ainda.
          </div>
        ) : (
          <div className="pco-card overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Para</th>
                  <th className="text-left px-3 py-2 font-medium">Assunto</th>
                  <th className="text-left px-3 py-2 font-medium">Tag</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {(logs.data ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-ink-muted">
                      {new Date(l.ts).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-pco-deep">{l.to}</td>
                    <td className="px-3 py-2">{l.subject}</td>
                    <td className="px-3 py-2 text-ink-subtle">{l.tag ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`pco-badge ${
                          l.status === 'sent'
                            ? 'bg-status-success/10 text-status-success'
                            : l.status === 'failed'
                              ? 'bg-status-danger/15 text-status-danger'
                              : 'bg-surface-gray text-ink-muted'
                        }`}
                      >
                        {l.status}
                      </span>
                      {l.error && (
                        <span className="block mt-0.5 text-[10px] text-status-danger">
                          {l.error}
                        </span>
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

function SendTestButton({ onSend }: { onSend: (to: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        const to = prompt('Enviar e-mail de teste para:', '');
        if (to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) onSend(to);
      }}
      className="pco-btn-ghost text-xs"
    >
      <Send size={11} strokeWidth={2} />
      Enviar teste
    </button>
  );
}

function ConfigEditor({
  editing,
  providers,
  onSave,
  onCancel,
}: {
  editing: EmailConfigDto | null;
  providers: EmailProviderIdDto[];
  onSave: (input: {
    provider: EmailProviderIdDto;
    enabled: boolean;
    fromEmail: string;
    fromName?: string;
    replyToEmail?: string;
    apiKey?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState<EmailProviderIdDto>(
    editing?.provider ?? 'resend',
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [fromEmail, setFromEmail] = useState(editing?.fromEmail ?? '');
  const [fromName, setFromName] = useState(editing?.fromName ?? 'AVA PCO');
  const [replyTo, setReplyTo] = useState(editing?.replyToEmail ?? '');
  const [apiKey, setApiKey] = useState('');

  useMemo(() => {
    setProvider(editing?.provider ?? 'resend');
    setEnabled(editing?.enabled ?? true);
    setFromEmail(editing?.fromEmail ?? '');
    setFromName(editing?.fromName ?? 'AVA PCO');
    setReplyTo(editing?.replyToEmail ?? '');
    setApiKey('');
  }, [editing]);

  return (
    <section className="pco-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.fromEmail}` : 'Nova configuração'}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Provider
          </span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as EmailProviderIdDto)}
            className="pco-input mt-1 text-sm w-full"
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {p} — {PROVIDER_DESCRIPTION[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 mt-5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-pco-blue"
          />
          <span className="text-sm">Habilitada</span>
        </label>
        <Input
          label="From e-mail"
          value={fromEmail}
          onChange={setFromEmail}
          placeholder="contato@psicanaliseclinica.online"
        />
        <Input
          label="From nome"
          value={fromName}
          onChange={setFromName}
          placeholder="AVA PCO"
        />
        <Input
          label="Reply-to (opcional)"
          value={replyTo}
          onChange={setReplyTo}
          placeholder="suporte@psicanaliseclinica.online"
        />
        <Input
          label={
            editing?.hasApiKey
              ? 'API key (vazio = manter atual)'
              : 'API key / Server token'
          }
          value={apiKey}
          onChange={setApiKey}
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
              provider,
              enabled,
              fromEmail,
              fromName: fromName || undefined,
              replyToEmail: replyTo || undefined,
              apiKey: apiKey || undefined,
            })
          }
          disabled={!fromEmail}
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
