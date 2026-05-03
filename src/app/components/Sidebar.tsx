import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Home,
  Compass,
  GraduationCap,
  BookOpen,
  Newspaper,
  Mic2,
  Bot,
  Award,
  LifeBuoy,
  UserCircle2,
  Stethoscope,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import Logo from './Logo';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const studentGroups: NavGroup[] = [
  {
    title: 'Estudo',
    items: [
      { to: '/dashboard', label: 'Início', icon: Home },
      { to: '/jornada', label: 'Minha Jornada', icon: Compass },
      { to: '/cursos', label: 'Meus Cursos', icon: GraduationCap },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { to: '/biblioteca', label: 'Biblioteca PCO', icon: BookOpen },
      { to: '/news', label: 'PCO News', icon: Newspaper },
      { to: '/podcasts', label: 'PCO POD', icon: Mic2 },
      { to: '/tutor', label: 'Tutor Virtual', icon: Bot },
      { to: '/analise-supervisao', label: 'Análise e Supervisão', icon: Stethoscope },
    ],
  },
  {
    title: 'Conta',
    items: [
      { to: '/certificados', label: 'Certificados', icon: Award },
      { to: '/suporte', label: 'Suporte', icon: LifeBuoy },
      { to: '/perfil', label: 'Meu Perfil', icon: UserCircle2 },
    ],
  },
];

interface SidebarProps {
  variant?: 'student' | 'admin';
  groups?: NavGroup[];
}

export default function Sidebar({ variant = 'student', groups }: SidebarProps) {
  const items = groups ?? studentGroups;
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-surface-gray bg-white">
      <div className="px-5 py-5 border-b border-surface-gray">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to ||
                  (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={() =>
                        clsx(
                          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ease-smooth',
                          isActive
                            ? 'bg-pco-blue/10 text-pco-deep'
                            : 'text-ink-muted hover:bg-surface-gray hover:text-pco-deep',
                        )
                      }
                    >
                      <Icon
                        className={clsx(
                          'h-4.5 w-4.5 shrink-0 transition-colors',
                          isActive ? 'text-pco-blue' : 'text-ink-subtle group-hover:text-pco-blue',
                        )}
                        size={18}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-pco-blue" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-surface-gray">
        <NavLink
          to={variant === 'admin' ? '/admin/configuracoes' : '/perfil'}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-muted hover:bg-surface-gray hover:text-pco-deep transition-colors"
        >
          <SettingsIcon size={18} strokeWidth={1.75} className="text-ink-subtle" />
          Configurações
        </NavLink>
      </div>
    </aside>
  );
}
