import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { useT } from '../i18n';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'compact';
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <div className="text-center py-6 px-4">
        <div className="mx-auto h-10 w-10 rounded-xl bg-surface-gray grid place-items-center mb-3">
          {icon ?? <Inbox className="text-ink-subtle" size={18} strokeWidth={1.5} />}
        </div>
        <div className="text-sm font-semibold text-pco-deep">{title}</div>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-pco-blue/10 grid place-items-center mb-4">
        {icon ?? <Inbox className="text-pco-blue" size={26} strokeWidth={1.5} />}
      </div>
      <h3 className="text-base font-semibold text-pco-deep">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const t = useT();
  const titleText = title ?? t('error.unknown');
  const descText = description ?? t('error.network');
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-status-danger/10 grid place-items-center mb-4">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-status-danger"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-pco-deep">{titleText}</h3>
      <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">{descText}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
