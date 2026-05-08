import { useState } from 'react';
import {
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  downloadSettingsBackup,
  restoreSettings,
  type SettingsBackupDto,
  type RestoreResultDto,
} from '../../data/api';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';

export default function AdminBackup() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.backups')} — Admin` });
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [restorePayload, setRestorePayload] = useState<SettingsBackupDto | null>(null);
  const [lastResult, setLastResult] = useState<RestoreResultDto | null>(null);

  async function handleDownload() {
    setBusy(true);
    try {
      await downloadSettingsBackup();
      toast.success('Backup baixado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as SettingsBackupDto;
      if (data.version !== 1 || !Array.isArray(data.files)) {
        toast.error('Arquivo inválido', 'Não é um backup do AVA PCO (v1).');
        return;
      }
      setRestorePayload(data);
      setLastResult(null);
      toast.info('Backup carregado', `${data.files.length} arquivos`);
    } catch (err) {
      toast.error('Falha ao ler arquivo', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleRestore(dryRun: boolean) {
    if (!restorePayload) return;
    if (
      !dryRun &&
      !confirm(
        `RESTAURAR configurações?\n\nIsto SOBRESCREVE os arquivos atuais de configuração: gateways, e-mail, webhooks, products, coupons, etc.\n\nNão afeta usuários, pedidos, audit log.\n\nProsseguir?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await restoreSettings(restorePayload, dryRun);
      setLastResult(r);
      toast.success(
        dryRun ? 'Dry-run finalizado' : 'Restore concluído',
        `${r.restored.length} restaurados, ${r.skipped.length} ignorados`,
      );
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Database size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.backups')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Exporta/importa configurações do AVA (gateways, e-mail, webhooks, produtos,
          cupons, IAs, importadores). <strong>Não inclui</strong> usuários, pedidos, audit
          log.
        </p>
      </header>

      <section className="pco-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Download size={14} className="text-pco-blue" strokeWidth={1.75} />
          Exportar
        </h2>
        <p className="text-xs text-ink-muted">
          Baixe um JSON com snapshot de todas as configurações. Credenciais já estão
          criptografadas no formato do AES-GCM. Mesmo assim, guarde o arquivo em local
          seguro.
        </p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="pco-btn-primary text-xs"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          Baixar backup
        </button>
      </section>

      <section className="pco-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Upload size={14} className="text-pco-blue" strokeWidth={1.75} />
          Importar
        </h2>
        <p className="text-xs text-ink-muted">
          Selecione um JSON de backup para restaurar. Faça <strong>dry-run primeiro</strong>{' '}
          para ver o que será sobrescrito.
        </p>
        <div className="rounded-lg border border-pco-orange/30 bg-pco-orange/5 p-3 text-xs text-pco-orange flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            O restore <strong>sobrescreve</strong> arquivos de config atuais. Não dá para
            desfazer (a menos que tenha outro backup).
          </span>
        </div>
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          className="text-xs"
        />
        {restorePayload && (
          <div className="rounded-lg bg-surface-mute p-3 text-xs space-y-2">
            <div>
              Backup carregado:{' '}
              <strong>{new Date(restorePayload.createdAt).toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              Arquivos:{' '}
              {restorePayload.files
                .filter((f) => f.exists)
                .map((f) => f.file)
                .join(', ')}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleRestore(true)}
                disabled={busy}
                className="pco-btn-ghost text-xs"
              >
                Dry-run
              </button>
              <button
                type="button"
                onClick={() => handleRestore(false)}
                disabled={busy}
                className="pco-btn-primary text-xs"
              >
                {busy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Upload size={11} />
                )}
                Restaurar
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestorePayload(null);
                  setLastResult(null);
                }}
                className="pco-btn-ghost text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {lastResult && (
        <section className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
            <CheckCircle2 size={14} className="text-status-success" />
            {lastResult.dryRun ? 'Dry-run' : 'Restore'} concluído
          </div>
          {lastResult.restored.length > 0 && (
            <div className="text-xs">
              <strong>Restaurados:</strong> {lastResult.restored.join(', ')}
            </div>
          )}
          {lastResult.skipped.length > 0 && (
            <div className="text-xs">
              <strong>Ignorados:</strong>
              <ul className="mt-1 space-y-0.5">
                {lastResult.skipped.map((s) => (
                  <li key={s.file} className="text-ink-muted">
                    {s.file}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
