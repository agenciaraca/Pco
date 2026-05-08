import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  PlayCircle,
} from 'lucide-react';
import {
  useBackups,
  useDeleteBackup,
  useRunBackupNow,
  useBackupSnapshots,
  useBackupStatus,
  useRunBackupSnapshotNow,
  useStorageStats,
} from '../../data/hooks';
import { downloadBackup } from '../../data/api';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useT } from '../../i18n';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AdminBackups() {
  const t = useT();
  const backups = useBackups();
  const delMut = useDeleteBackup();
  const runMut = useRunBackupNow();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function handleDownload(name: string) {
    setPending(name);
    try {
      await downloadBackup(name);
      toast.success('Download iniciado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!confirm) return;
    try {
      await delMut.mutateAsync(confirm);
      toast.success('Backup removido');
      setConfirm(null);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const totalSize = (backups.data ?? []).reduce((s, b) => s + b.sizeBytes, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep">{t('admin.nav.backups')}</h1>
          <p className="text-sm text-ink-muted">
            Backups automáticos diários (cron 03:00 UTC) das tabelas JSON. Retenção de 14 dias.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const res = await runMut.mutateAsync();
                toast.success('Backup criado', res.name);
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            disabled={runMut.isPending}
            className="pco-btn-primary text-xs"
          >
            <PlayCircle size={12} strokeWidth={2} />
            {runMut.isPending ? 'Criando...' : 'Backup agora'}
          </button>
          <button
            onClick={() => backups.refetch()}
            disabled={backups.isFetching}
            className="pco-btn-secondary text-xs"
          >
            <RefreshCw
              size={12}
              strokeWidth={2}
              className={backups.isFetching ? 'animate-spin' : ''}
            />
            Atualizar
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          Icon={Database}
          label="Total de backups"
          value={String((backups.data ?? []).length)}
          color="text-pco-blue"
        />
        <Stat
          Icon={HardDrive}
          label="Tamanho total"
          value={formatSize(totalSize)}
          color="text-pco-cyan"
        />
        <Stat
          Icon={ShieldCheck}
          label="Cron"
          value="03:00 UTC"
          color="text-status-success"
        />
        <Stat
          Icon={ShieldCheck}
          label="Último backup"
          value={
            backups.data && backups.data.length > 0
              ? new Date(backups.data[0]!.mtime).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
          color="text-pco-orange"
        />
      </div>

      {backups.isLoading ? (
        <CardListSkeleton count={4} />
      ) : backups.isError ? (
        <ErrorState
          action={
            <button onClick={() => backups.refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : !backups.data || backups.data.length === 0 ? (
        <EmptyState
          title="Nenhum backup ainda"
          description="O primeiro backup será gerado pelo cron às 03:00 UTC."
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-mute text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Arquivo</th>
                <th className="text-left px-3 py-2 font-medium">Tamanho</th>
                <th className="text-left px-3 py-2 font-medium">Modificado</th>
                <th className="text-right px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {backups.data.map((b) => (
                <tr key={b.name} className="hover:bg-surface-mute/40">
                  <td className="px-3 py-2 font-mono text-xs text-pco-deep break-all">
                    {b.name}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{formatSize(b.sizeBytes)}</td>
                  <td className="px-3 py-2 text-xs text-ink-muted whitespace-nowrap">
                    {new Date(b.mtime).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(b.name)}
                        disabled={pending === b.name}
                        className="pco-btn-ghost text-xs px-2.5"
                        title="Baixar"
                      >
                        <Download size={12} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => setConfirm(b.name)}
                        className="pco-btn-ghost text-xs px-2.5 text-status-danger"
                        title="Excluir"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SnapshotsSection />

      <ConfirmDialog
        open={!!confirm}
        title="Excluir backup?"
        description={
          confirm && (
            <>
              Arquivo <strong>{confirm}</strong> será removido do servidor permanentemente.
            </>
          )
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={delMut.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
  color,
}: {
  Icon: typeof Database;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="pco-card p-4">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={2} className={color} />
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold text-pco-deep">{value}</div>
    </div>
  );
}

function SnapshotsSection() {
  const snapshots = useBackupSnapshots();
  const status = useBackupStatus();
  const storage = useStorageStats();
  const runMut = useRunBackupSnapshotNow();
  const toast = useToast();

  return (
    <section className="space-y-3">
      {storage.data && (
        <div className="grid gap-3 sm:grid-cols-4 pt-4 border-t border-pco-border">
          <div className="pco-card p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              DATA_DIR total
            </div>
            <div className="text-xl font-bold text-pco-deep mt-0.5">
              {storage.data.totalMB} MB
            </div>
          </div>
          <div className="pco-card p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              Stores JSON
            </div>
            <div className="text-xl font-bold text-pco-deep mt-0.5">
              {storage.data.jsonFilesCount}
            </div>
          </div>
          <div className="pco-card p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              Snapshots
            </div>
            <div className="text-xl font-bold text-pco-deep mt-0.5">
              {storage.data.backupFoldersCount}
            </div>
          </div>
          <div className="pco-card p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              Uploads
            </div>
            <div className="text-xl font-bold text-pco-deep mt-0.5">
              {storage.data.uploadFilesCount}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-pco-deep">
            Snapshots automáticos (JSON stores)
          </h2>
          <p className="text-xs text-ink-muted">
            Cópia diária dos arquivos JSON do DATA_DIR. Roda 04h UTC (1h BRT).
            Mantém os últimos {status.data?.keepDays ?? 14} dias.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              const r = await runMut.mutateAsync();
              toast.success(
                'Snapshot criado',
                `${r.filesBackedUp} arquivo(s), ${(r.bytesTotal / 1024).toFixed(1)} kB`,
              );
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
          disabled={runMut.isPending}
          className="pco-btn-ghost text-xs"
        >
          <PlayCircle size={11} strokeWidth={2} />
          Snapshot agora
        </button>
      </div>

      {snapshots.isLoading ? (
        <CardListSkeleton count={2} />
      ) : (snapshots.data ?? []).length === 0 ? (
        <p className="text-xs text-ink-subtle">
          Nenhum snapshot ainda. Será criado às 04h UTC.
        </p>
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-mute text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Data</th>
                <th className="text-left px-3 py-2 font-medium">Arquivos</th>
                <th className="text-right px-3 py-2 font-medium">Tamanho total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {(snapshots.data ?? []).map((s) => {
                const total = s.files.reduce((sum, f) => sum + f.size, 0);
                return (
                  <tr key={s.date} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 font-mono text-pco-deep">{s.date}</td>
                    <td className="px-3 py-2 text-ink-muted">
                      {s.files.length} arquivo(s)
                      <details className="mt-1">
                        <summary className="cursor-pointer text-pco-blue text-[10px]">
                          ver detalhes
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {s.files.map((f) => (
                            <li key={f.name} className="text-[10px] font-mono">
                              {f.name} —{' '}
                              <span className="text-ink-subtle">
                                {(f.size / 1024).toFixed(1)} kB
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">
                      {(total / 1024).toFixed(1)} kB
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
