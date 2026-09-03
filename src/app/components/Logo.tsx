import clsx from 'clsx';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
  variant?: 'light' | 'dark'; // dark = para fundo escuro (logo branca)
}

export default function Logo({ collapsed = false, className, variant = 'light' }: LogoProps) {
  if (variant === 'dark') {
    // Logomarca completa da PCO em branco — para uso em hero/login dark
    return (
      <img
        src="/logo-pco-dark.png"
        alt="PCO — Psicanálise Clínica Online"
        className={clsx('h-12 w-auto object-contain', className)}
      />
    );
  }
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <img
        src="/icone-pco.png"
        alt="PCO"
        className="h-9 w-9 rounded-xl object-contain shadow-soft bg-white"
      />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-extrabold tracking-tight text-pco-deep">
            AVA <span className="text-pco-blue">PCO</span>
          </div>
          <div className="text-xs font-medium text-ink-subtle tracking-wide uppercase">
            Aprendizagem
          </div>
        </div>
      )}
    </div>
  );
}
