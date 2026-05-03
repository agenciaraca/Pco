import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (
    title: string,
    options?: { description?: string; variant?: ToastVariant; duration?: number },
  ) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>((title, options = {}) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ToastItem = {
      id,
      variant: options.variant ?? 'info',
      title,
      description: options.description,
      duration: options.duration ?? 4000,
    };
    setItems((prev) => [...prev, item]);
  }, []);

  const value: ToastContextValue = {
    toast,
    success: (title, description) => toast(title, { variant: 'success', description }),
    error: (title, description) => toast(title, { variant: 'error', description }),
    warning: (title, description) => toast(title, { variant: 'warning', description }),
    info: (title, description) => toast(title, { variant: 'info', description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onClose]);

  const map = {
    success: {
      icon: <CheckCircle2 size={18} className="text-status-success" strokeWidth={1.75} />,
      border: 'border-status-success/30',
      bg: 'bg-status-success/5',
    },
    error: {
      icon: <XCircle size={18} className="text-status-danger" strokeWidth={1.75} />,
      border: 'border-status-danger/30',
      bg: 'bg-status-danger/5',
    },
    warning: {
      icon: <AlertCircle size={18} className="text-pco-orange" strokeWidth={1.75} />,
      border: 'border-pco-orange/30',
      bg: 'bg-pco-orange/5',
    },
    info: {
      icon: <Info size={18} className="text-pco-blue" strokeWidth={1.75} />,
      border: 'border-pco-blue/30',
      bg: 'bg-pco-blue/5',
    },
  }[item.variant];

  return (
    <div
      className={clsx(
        'pointer-events-auto rounded-2xl border bg-white shadow-lift transition-all duration-200 ease-smooth',
        visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
        map.border,
      )}
    >
      <div className={clsx('rounded-2xl p-4 flex items-start gap-3', map.bg)}>
        <span className="shrink-0 mt-0.5">{map.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-pco-deep">{item.title}</div>
          {item.description && (
            <p className="mt-0.5 text-xs text-ink-muted">{item.description}</p>
          )}
        </div>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 200);
          }}
          className="text-ink-subtle hover:text-pco-deep h-6 w-6 grid place-items-center rounded-md hover:bg-surface-gray"
          aria-label="Fechar"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
