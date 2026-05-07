import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react';
import Logo from './Logo';
import { useT } from '../i18n';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  variant?: 'student' | 'admin';
  groups?: NavGroup[];
}

const COLLAPSED_KEY = 'ava-pco-sidebar-collapsed';
const GROUPS_KEY_PREFIX = 'ava-pco-sidebar-groups:';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readExpandedGroups(
  variant: string,
  defaults: Record<string, boolean>,
): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY_PREFIX + variant);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    // Merge defaults com persistência (novos grupos abrem por padrão)
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function isItemActive(pathname: string, to: string, isHomepage: boolean): boolean {
  if (pathname === to) return true;
  if (isHomepage) return false;
  return pathname.startsWith(to + '/');
}

export default function Sidebar({ variant = 'student', groups }: SidebarProps) {
  const t = useT();
  const studentGroups = useMemo<NavGroup[]>(
    () => [
      {
        title: t('nav.dashboard'),
        items: [
          { to: '/dashboard', label: t('nav.dashboard'), icon: Home },
          { to: '/jornada', label: 'Minha Jornada', icon: Compass },
          { to: '/cursos', label: t('nav.courses'), icon: GraduationCap },
        ],
      },
      {
        title: 'PCO',
        items: [
          { to: '/biblioteca', label: t('nav.library'), icon: BookOpen },
          { to: '/news', label: t('nav.news'), icon: Newspaper },
          { to: '/podcasts', label: t('nav.podcasts'), icon: Mic2 },
          { to: '/tutor', label: 'Tutor Virtual', icon: Bot },
          { to: '/analise-supervisao', label: 'Análise e Supervisão', icon: Stethoscope },
        ],
      },
      {
        title: t('nav.profile'),
        items: [
          { to: '/certificados', label: t('nav.certificates'), icon: Award },
          { to: '/suporte', label: t('nav.support'), icon: LifeBuoy },
          { to: '/perfil', label: t('nav.profile'), icon: UserCircle2 },
        ],
      },
    ],
    [t],
  );
  const items = groups ?? studentGroups;
  const location = useLocation();

  // Default: todos abertos
  const defaultExpanded = useMemo(
    () => Object.fromEntries(items.map((g) => [g.title, true])),
    [items],
  );

  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    readExpandedGroups(variant, defaultExpanded),
  );

  // Auto-expande grupo da rota ativa (exceto se sidebar colapsada)
  useEffect(() => {
    if (collapsed) return;
    const activeGroup = items.find((g) =>
      g.items.some((item) =>
        isItemActive(
          location.pathname,
          item.to,
          item.to === '/dashboard' || item.to === '/admin/dashboard',
        ),
      ),
    );
    if (activeGroup && !expanded[activeGroup.title]) {
      setExpanded((prev) => ({ ...prev, [activeGroup.title]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, collapsed]);

  // Persiste estado em localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY_PREFIX + variant, JSON.stringify(expanded));
    } catch {
      /* ignore */
    }
  }, [expanded, variant]);

  const toggleGroup = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col shrink-0 border-r border-surface-gray bg-white transition-[width] duration-200 ease-smooth',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
      aria-label="Navegação principal"
    >
      <div
        className={clsx(
          'flex items-center border-b border-surface-gray',
          collapsed ? 'px-2 py-3 justify-center' : 'px-5 py-5 justify-between',
        )}
      >
        {!collapsed && <Logo />}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={clsx(
            'inline-flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-gray hover:text-pco-deep transition-colors',
            collapsed ? 'h-9 w-9' : 'h-7 w-7',
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <ChevronsRight size={18} strokeWidth={1.75} />
          ) : (
            <ChevronsLeft size={16} strokeWidth={1.75} />
          )}
        </button>
      </div>

      <nav
        className={clsx(
          'flex-1 overflow-y-auto overflow-x-hidden',
          collapsed ? 'px-1.5 py-3' : 'px-3 py-4',
        )}
      >
        {items.map((group, groupIndex) => {
          const groupOpen = collapsed ? true : expanded[group.title] !== false;
          const groupHasActive = group.items.some((item) =>
            isItemActive(
              location.pathname,
              item.to,
              item.to === '/dashboard' || item.to === '/admin/dashboard',
            ),
          );

          return (
            <div key={group.title} className={clsx(collapsed ? 'mb-2' : 'mb-4 last:mb-0')}>
              {/* Header do grupo */}
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className={clsx(
                    'group w-full flex items-center justify-between px-3 mb-1 rounded-md py-1 transition-colors',
                    'text-[10px] font-semibold uppercase tracking-wider',
                    groupHasActive ? 'text-pco-blue' : 'text-ink-subtle hover:text-ink-muted',
                  )}
                  aria-expanded={groupOpen}
                  aria-controls={`group-${variant}-${group.title}`}
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    size={14}
                    strokeWidth={2}
                    className={clsx(
                      'transition-transform duration-150 opacity-60 group-hover:opacity-100',
                      groupOpen ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                </button>
              ) : (
                /* Em modo collapsed, separador visual entre grupos (não no primeiro) */
                groupIndex > 0 && (
                  <div
                    className="mx-2 mb-1.5 h-px bg-surface-gray/70"
                    aria-hidden="true"
                  />
                )
              )}

              {/* Itens do grupo */}
              <ul
                id={`group-${variant}-${group.title}`}
                className={clsx(
                  'overflow-hidden transition-[max-height,opacity] duration-200 ease-smooth space-y-0.5',
                  groupOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
                )}
                aria-hidden={!groupOpen}
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isHomepage =
                    item.to === '/dashboard' || item.to === '/admin/dashboard';
                  const isActive = isItemActive(location.pathname, item.to, isHomepage);

                  if (collapsed) {
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          title={item.label}
                          aria-label={item.label}
                          className={() =>
                            clsx(
                              'group relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 transition-all duration-150 ease-smooth',
                              isActive
                                ? 'bg-pco-blue/10 text-pco-deep'
                                : 'text-ink-muted hover:bg-surface-gray hover:text-pco-deep',
                            )
                          }
                        >
                          <Icon
                            className={clsx(
                              'shrink-0 transition-colors',
                              isActive ? 'text-pco-blue' : 'text-ink-subtle group-hover:text-pco-blue',
                            )}
                            size={20}
                            strokeWidth={1.75}
                          />
                          <span className="text-[10px] leading-tight text-center font-medium line-clamp-2 break-words w-full px-0.5">
                            {item.label}
                          </span>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r bg-pco-blue" />
                          )}
                        </NavLink>
                      </li>
                    );
                  }

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
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 py-3 border-t border-surface-gray">
          <NavLink
            to={variant === 'admin' ? '/admin/configuracoes' : '/perfil'}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-muted hover:bg-surface-gray hover:text-pco-deep transition-colors"
          >
            <SettingsIcon size={18} strokeWidth={1.75} className="text-ink-subtle" />
            Configurações
          </NavLink>
        </div>
      )}
    </aside>
  );
}
