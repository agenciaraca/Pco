import { AlertTriangle } from 'lucide-react';

/**
 * Banner discreto no topo quando ambiente não é production.
 * Detecta por VITE_ENV ou NODE_ENV. Em produção, retorna null.
 */
export default function EnvBanner() {
  const env = import.meta.env.VITE_ENV ?? import.meta.env.MODE ?? 'production';
  if (env === 'production') return null;
  const label = env === 'development' ? 'DEV' : env.toUpperCase();
  return (
    <div className="bg-pco-orange/15 border-b border-pco-orange/40 text-pco-orange px-4 py-1 text-xs font-semibold flex items-center justify-center gap-2">
      <AlertTriangle size={11} strokeWidth={2} />
      <span>
        Ambiente: <strong>{label}</strong> — não é produção. Os dados podem ser
        resetados a qualquer momento.
      </span>
    </div>
  );
}
