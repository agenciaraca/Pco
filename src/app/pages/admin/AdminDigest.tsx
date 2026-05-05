import { useState } from 'react';
import {
  Mail,
  Send,
  Eye,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  useDigestConfig,
  useUpdateDigestConfig,
  useDigestPreview,
  useRunDigestNow,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export default function AdminDigest() {
  useDocumentMeta({ title: 'Digest diário — Admin AVA PCO' });
  const cfg = useDigestConfig();
  const update = useUpdateDigestConfig();
  const preview = useDigestPreview();
  const runNow = useRunDigestNow();
  const toast = useToast();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hourUtc, setHourUtc] = useState<number | null>(null);
  const [roles, setRoles] = useState<Array<'admin' | 'superadmin'> | null>(null);

  const current = cfg.data;
  const effEnabled = enabled ?? current?.enabled ?? false;
  const effHour = hourUtc ?? current?.hourUtc ?? 11;
  const effRoles = roles ?? current?.recipientRoles ?? ['admin', 'superadmin'];

  const dirty =
    current &&
    (effEnabled !== current.enabled ||
      effHour !== current.hourUtc ||
      JSON.stringify([...effRoles].sort()) !==
        JSON.stringify([...current.recipientRoles].sort()));

  function toggleRole(role: 'admin' | 'superadmin') {
    setRoles((prev) => {
      const cur = prev ?? current?.recipientRoles ?? ['admin', 'superadmin'];
      if (cur.includes(role)) return cur.filter((r) => r !== role);
      return [...cur, role];
    });
  }

  async function handleSave() {
    try {
      await update.mutateAsync({
        enabled: effEnabled,
        hourUtc: effHour,
        recipientRoles: effRoles,
      });
      toast.success('Salvo');
      setEnabled(null);
      setHourUtc(null);
      setRoles(null);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleRunNow(dryRun: boolean) {
    try {
      const r = await runNow.mutateAsync(dryRun);
      if (dryRun) {
        toast.info(
          'Dry-run',
          `${r.recipientCount} destinatários seriam contatados.`,
        );
      } else {
        toast.success(
          'Enviado',
          `${r.sent} enviados, ${r.errors} erros (${r.recipientCount} alvos).`,
        );
      }
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Mail size={20} className="text-pco-blue" strokeWidth={1.75} />
          Digest diário admin
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Envia automaticamente um resumo das últimas 24h para admins (vendas,
          novos alunos, certificados, erros).
        </p>
      </header>

      <section className="pco-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pco-deep">Configuração</h2>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={effEnabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-pco-blue"
          />
          <span>Ativo — enviar todos os dias</span>
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Hora de envio (UTC; BRT = UTC-3)
          </span>
          <input
            type="number"
            min={0}
            max={23}
            value={effHour}
            onChange={(e) => setHourUtc(Number(e.target.value))}
            className="pco-input mt-1 text-sm w-32"
          />
          <span className="ml-2 text-[11px] text-ink-subtle">
            {String(effHour).padStart(2, '0')}:00 UTC ={' '}
            {String((effHour - 3 + 24) % 24).padStart(2, '0')}:00 BRT
          </span>
        </label>

        <div>
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Destinatários
          </span>
          <div className="mt-1 flex gap-3 flex-wrap">
            {(['admin', 'superadmin'] as const).map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={effRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="accent-pco-blue"
                />
                <span>{role}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {dirty && (
            <span className="text-[11px] text-pco-orange">Alterações não salvas</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || update.isPending}
            className="pco-btn-primary"
          >
            {update.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} strokeWidth={2} />
            )}
            Salvar
          </button>
        </div>
      </section>

      <section className="pco-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Send size={14} strokeWidth={2} />
          Disparar agora (manual)
        </h2>
        <p className="text-[11px] text-ink-muted">
          Útil para testar o conteúdo. Dry-run não envia, só conta destinatários.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRunNow(true)}
            disabled={runNow.isPending}
            className="pco-btn-ghost text-xs"
          >
            {runNow.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Eye size={11} strokeWidth={2} />
            )}
            Dry-run
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm('Enviar email para todos admins agora?')) return;
              void handleRunNow(false);
            }}
            disabled={runNow.isPending}
            className="pco-btn-secondary text-xs"
          >
            <Send size={11} strokeWidth={2} />
            Enviar real
          </button>
        </div>
      </section>

      <section className="pco-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Eye size={14} strokeWidth={2} />
          Pré-visualização
        </h2>
        {preview.isLoading ? (
          <div className="text-sm text-ink-muted">Gerando...</div>
        ) : preview.data ? (
          <>
            <div className="text-[11px] text-ink-subtle">
              <strong>Assunto:</strong> {preview.data.subject}
            </div>
            <div className="rounded border border-pco-border overflow-hidden">
              <iframe
                srcDoc={preview.data.html}
                title="Digest preview"
                className="w-full h-[480px] bg-white"
              />
            </div>
            <details className="mt-2">
              <summary className="text-xs text-pco-blue cursor-pointer">
                Dados crus
              </summary>
              <pre className="text-[10px] bg-surface-mute p-2 rounded mt-1 overflow-auto">
                {JSON.stringify(preview.data.data, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-status-danger">
            <AlertCircle size={14} />
            Falha ao gerar preview.
          </div>
        )}
      </section>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-3 flex gap-2 items-start text-xs">
        <CheckCircle2 size={14} className="text-pco-blue shrink-0 mt-0.5" />
        <div className="text-ink-muted">
          O digest depende de provider de email configurado em{' '}
          <code>/admin/email</code>. Sem provider ativo, o envio falha
          silenciosamente.
        </div>
      </div>
    </div>
  );
}
