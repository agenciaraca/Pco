import { Construction } from 'lucide-react';
import { type ReactNode } from 'react';

interface PlaceholderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  children?: ReactNode;
}

export default function Placeholder({
  title,
  subtitle,
  description,
  badge = 'Em construção',
  children,
}: PlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="pco-section-title">{title}</h1>
          {subtitle && <p className="pco-section-subtitle mt-1">{subtitle}</p>}
        </div>
        <span className="pco-badge bg-pco-orange/10 text-pco-orange">
          <span className="h-1.5 w-1.5 rounded-full bg-pco-orange" />
          {badge}
        </span>
      </div>

      <div className="pco-card">
        <div className="flex flex-col items-center text-center py-10 px-6">
          <div className="h-14 w-14 rounded-2xl bg-pco-blue/10 grid place-items-center mb-4">
            <Construction className="text-pco-blue" size={26} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-pco-deep mb-1">
            Em breve, esta página estará completa
          </h2>
          <p className="text-sm text-ink-muted max-w-md">
            {description ??
              'Esta tela já está prevista na arquitetura do AVA PCO e ficará disponível nas próximas iterações.'}
          </p>
          {children && <div className="mt-8 w-full">{children}</div>}
        </div>
      </div>
    </div>
  );
}
