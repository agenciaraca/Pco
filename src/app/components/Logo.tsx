import clsx from 'clsx';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

export default function Logo({ collapsed = false, className }: LogoProps) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-pco-blue to-pco-cyan shadow-soft">
        <span className="absolute inset-0 grid place-items-center font-display text-base font-extrabold text-white">
          P
        </span>
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-extrabold tracking-tight text-pco-deep">
            AVA <span className="text-pco-blue">PCO</span>
          </div>
          <div className="text-[10px] font-medium text-ink-subtle tracking-wide uppercase">
            Aprendizagem
          </div>
        </div>
      )}
    </div>
  );
}
