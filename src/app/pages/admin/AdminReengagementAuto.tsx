import { useEffect, useState } from 'react';
import {
  Sparkles,
  Save,
  Play,
  History as HistoryIcon,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  useReengagementConfig,
  useUpdateReengagementConfig,
  useReengagementSent,
  useRunReengagement,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export default function AdminReengagementAuto() {
  useDocumentMeta({ title: 'Reengajamento automático — Admin' });
  const cfg = useReengagementConfig();
  const update = useUpdateReengagementConfig();
  const sent = useReengagementSent();
  const run = useRunReengagement();
  const toast = useToast();

  const [enabled, setEnabled] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(14);
  const [cooldownDays, setCooldownDays] = useState(14);
  const [onlyEnrolled, setOnlyEnrolled] = useState(true);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  useEffect(() => {
    if (cfg.data) {
      setEnabled(cfg.data.enabled);
      setInactivityDays(cfg.data.inactivityDays);
      setCooldownDays(cfg.data.cooldownDays);
      setOnlyEnrolled(cfg.data.onlyEnrolled);
      setSubject(cfg.data.subject);
      setBodyHtml(cfg.data.bodyHtml);
    }
  }, [cfg.data]);

  async function handleSave() {
    try {
      await update.mutateAsync({
        enabled,
        inactivityDays,
        cooldownDays,
        onlyEnrolled,
        subject,
        bodyHtml,
      });
      toast.success('Configuração salva');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleRun(dryRun: boolean) {
    if (!dryRun && !enabled) {
      const ok = confirm(
        'A automação está DESATIVADA. Mesmo assim, você pode disparar uma execução manual. Deseja continuar?',
      );
      if (!ok) return;
    }
    if (!dryRun) {
      const ok = confirm(
        'Disparar e-mails reais agora? Use dry-run primeiro para ver quem seria contactado.',
      );
      if (!ok) return;
    }
    try {
      const r = await run.mutateAsync(dryRun);
      toast.success(
        dryRun ? 'Dry-run finalizado' : 'Execução concluída',
        `${r.scanned} alunos analisados · ${r.inactive} inativos · ${r.sent} ${dryRun ? 'seriam enviados' : 'enviados'} · ${r.skipped} ignorados (cooldown) · ${r.errors} erros`,
      );
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Sparkles size={20} className="text-pco-blue" strokeWidth={1.75} />
          Reengajamento automático
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Detecta alunos inativos e envia e-mail de retorno via módulo de e-mail
          transacional. Worker roda 1x por dia.
        </p>
      </header>

      <section className="pco-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pco-deep">Regras</h2>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-pco-blue"
          />
          <span>Automação habilitada</span>
          {enabled ? (
            <CheckCircle2 size={14} className="text-status-success" />
          ) : (
            <AlertTriangle size={14} className="text-pco-orange" />
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Inatividade (dias)">
            <input
              type="number"
              min={1}
              max={365}
              value={inactivityDays}
              onChange={(e) => setInactivityDays(Number(e.target.value))}
              className="pco-input text-sm"
            />
          </Field>
          <Field label="Cooldown (dias)">
            <input
              type="number"
              min={1}
              max={180}
              value={cooldownDays}
              onChange={(e) => setCooldownDays(Number(e.target.value))}
              className="pco-input text-sm"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input
              type="checkbox"
              checked={onlyEnrolled}
              onChange={(e) => setOnlyEnrolled(e.target.checked)}
              className="accent-pco-blue"
            />
            Só alunos com curso ativo
          </label>
        </div>
      </section>

      <section className="pco-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-pco-deep">Mensagem</h2>
        <p className="text-xs text-ink-muted">
          Variáveis disponíveis: <code>{'{{name}}'}</code>, <code>{'{{lastAccess}}'}</code>,{' '}
          <code>{'{{loginUrl}}'}</code>
        </p>
        <Field label="Assunto">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="pco-input text-sm"
          />
        </Field>
        <Field label="HTML do corpo">
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={10}
            className="pco-input text-xs font-mono"
          />
        </Field>
      </section>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          className="pco-btn-primary text-xs"
        >
          <Save size={11} strokeWidth={2} />
          {update.isPending ? 'Salvando...' : 'Salvar configuração'}
        </button>
        <button
          type="button"
          onClick={() => handleRun(true)}
          disabled={run.isPending}
          className="pco-btn-ghost text-xs"
        >
          <Play size={11} strokeWidth={2} />
          {run.isPending ? 'Rodando...' : 'Executar dry-run'}
        </button>
        <button
          type="button"
          onClick={() => handleRun(false)}
          disabled={run.isPending}
          className="pco-btn-ghost text-xs text-status-danger"
        >
          <Mail size={11} strokeWidth={2} />
          Disparar agora (real)
        </button>
      </div>

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2 flex items-center gap-2">
          <HistoryIcon size={16} className="text-pco-blue" strokeWidth={1.75} />
          Envios recentes
        </h2>
        {sent.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (sent.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhum envio registrado ainda.
          </div>
        ) : (
          <div className="pco-card overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Quando</th>
                  <th className="text-left px-3 py-2 font-medium">Aluno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {(sent.data ?? []).map((s) => (
                  <tr key={`${s.userId}-${s.ts}`}>
                    <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                      {new Date(s.ts).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-pco-deep">{s.email}</td>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
