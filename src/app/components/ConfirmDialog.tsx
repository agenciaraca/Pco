import { type ReactNode } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useT } from '../i18n';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const t = useT();
  const confirmText = confirmLabel ?? t('common.confirm');
  const cancelText = cancelLabel ?? t('common.cancel');
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center px-4"
      onClick={(e) => {
        if (e.currentTarget === e.target && !loading) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative pco-card w-full max-w-md p-0"
      >
        <div className="flex items-start gap-3 p-6">
          <div
            className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
              variant === 'danger' ? 'bg-status-danger/10' : 'bg-pco-blue/10'
            }`}
          >
            <AlertTriangle
              size={20}
              className={variant === 'danger' ? 'text-status-danger' : 'text-pco-blue'}
              strokeWidth={1.75}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-pco-deep">
              {title}
            </h2>
            {description && (
              <div className="mt-1 text-sm text-ink-muted">{description}</div>
            )}
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label={t('common.close')}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-6 py-4 border-t border-surface-gray flex items-center justify-end gap-2 rounded-b-2xl bg-surface-off">
          <button onClick={onCancel} disabled={loading} className="pco-btn-ghost text-xs">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`pco-btn text-xs ${
              variant === 'danger'
                ? 'bg-status-danger text-white hover:bg-[#b41510]'
                : 'pco-btn-primary'
            }`}
          >
            {loading && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
