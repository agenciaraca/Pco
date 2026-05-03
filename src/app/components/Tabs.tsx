import clsx from 'clsx';
import { type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
}

export default function Tabs({ items, active, onChange, variant = 'underline' }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-gray p-1">
        {items.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'bg-white text-pco-deep shadow-soft'
                  : 'text-ink-muted hover:text-pco-deep',
              )}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && (
                <span
                  className={clsx(
                    'pco-badge text-[10px]',
                    isActive ? 'bg-pco-blue/10 text-pco-blue' : 'bg-surface-gray text-ink-muted',
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border-b border-surface-gray overflow-x-auto -mx-1">
      <div className="flex gap-1 px-1 min-w-max">
        {items.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={clsx(
                'relative inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'text-pco-deep'
                  : 'text-ink-muted hover:text-pco-deep',
              )}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && (
                <span
                  className={clsx(
                    'pco-badge text-[10px]',
                    isActive
                      ? 'bg-pco-blue/10 text-pco-blue'
                      : 'bg-surface-gray text-ink-muted',
                  )}
                >
                  {t.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-pco-blue" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
