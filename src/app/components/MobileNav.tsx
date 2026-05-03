import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import Logo from './Logo';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
}

export default function MobileNav({ open, onClose, groups }: MobileNavProps) {
  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-40 bg-pco-deep/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-surface-gray transition-transform duration-300 ease-smooth lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-gray">
          <Logo />
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar menu"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <nav className="px-3 py-4 overflow-y-auto h-[calc(100%-65px)]">
          {groups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                {group.title}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium',
                            isActive
                              ? 'bg-pco-blue/10 text-pco-deep'
                              : 'text-ink-muted hover:bg-surface-gray',
                          )
                        }
                      >
                        <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
