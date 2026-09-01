import { Link, NavLink, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronUp,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react';
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

  // ---- rolagem própria do menu (só admin) ----
  //
  // São 60+ destinos em 9 grupos. Sem isto, alcançar o último exige rolar a
  // página inteira — e o conteúdo que a pessoa estava lendo sai da tela junto.
  const navRef = useRef<HTMLElement | null>(null);
  const [podeSubir, setPodeSubir] = useState(false);
  const [podeDescer, setPodeDescer] = useState(false);

  const atualizaSetas = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    // 2px de folga: arredondamento de subpixel faria o botão de baixo piscar
    // no fim da rolagem.
    setPodeSubir(el.scrollTop > 2);
    setPodeDescer(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    atualizaSetas();
    const el = navRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Abrir e fechar grupo muda a altura sem disparar scroll — sem observar,
    // o botão de baixo some quando ainda há menu embaixo.
    const ro = new ResizeObserver(atualizaSetas);
    ro.observe(el);
    for (const filho of Array.from(el.children)) ro.observe(filho);
    return () => ro.disconnect();
  }, [atualizaSetas, expanded, collapsed, items]);

  const rolar = (sentido: 1 | -1) => {
    const el = navRef.current;
    if (!el) return;
    // 70% da altura visível: sobra âncora do que estava na tela, para a pessoa
    // não perder o fio.
    el.scrollBy({ top: sentido * el.clientHeight * 0.7, behavior: 'smooth' });
  };

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col shrink-0 border-r border-surface-gray bg-white transition-[width] duration-200 ease-smooth',
        collapsed ? 'w-[72px]' : 'w-64',
        // O menu do admin gruda e rola por dentro; o do aluno é curto e segue
        // rolando com a página.
        variant === 'admin' && 'sticky top-0 h-screen',
      )}
      aria-label="Navegação principal"
    >
      {/* Mesma marca do topo do site: gradiente da casa e a logomarca em
          branco. Antes o painel abria com um cabeçalho branco e um logotipo
          diferente do que o visitante tinha acabado de ver — a passagem do site
          para o AVA parecia troca de produto. */}
      <div
        className={clsx(
          'flex items-center bg-gradient-to-r from-pco-deep via-pco-blue to-pco-cyan',
          collapsed ? 'px-2 py-3 justify-center' : 'px-5 py-4 justify-between',
        )}
      >
        {!collapsed && (
          <Link to="/dashboard" aria-label="AVA PCO — início">
            <img
              src="/logo-pco-dark.png"
              alt="PCO — Psicanálise Clínica Online"
              className="h-8 w-auto object-contain"
            />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={clsx(
            'inline-flex items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors',
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

      {/* `relative` para os botões flutuarem sobre a lista sem roubar altura. */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {variant === 'admin' && (
          <BotaoRolar direcao="cima" visivel={podeSubir} onClick={() => rolar(-1)} />
        )}
        <nav
          ref={navRef}
          onScroll={atualizaSetas}
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
        {variant === 'admin' && (
          <BotaoRolar direcao="baixo" visivel={podeDescer} onClick={() => rolar(1)} />
        )}
      </div>

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

/**
 * Botão de rolar o menu, colado no topo ou no rodapé da lista.
 *
 * Aparece só quando há menu naquela direção — botão que não leva a lugar
 * nenhum ensina a ignorar o botão. E some do fluxo quando escondido
 * (`pointer-events-none`), para não capturar clique do item que está embaixo.
 *
 * O degradê é funcional, não enfeite: ele avisa que o conteúdo continua atrás
 * do botão, que é a única pista que a pessoa tem de que a lista não acabou.
 */
function BotaoRolar({
  direcao,
  visivel,
  onClick,
}: {
  direcao: 'cima' | 'baixo';
  visivel: boolean;
  onClick: () => void;
}) {
  const paraCima = direcao === 'cima';
  return (
    <div
      className={clsx(
        'absolute inset-x-0 z-10 flex justify-center transition-opacity duration-150',
        paraCima ? 'top-0 pt-1 pb-4' : 'bottom-0 pb-1 pt-4',
        paraCima
          ? 'bg-gradient-to-b from-white via-white/90 to-transparent'
          : 'bg-gradient-to-t from-white via-white/90 to-transparent',
        visivel ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!visivel}
    >
      <button
        type="button"
        onClick={onClick}
        tabIndex={visivel ? 0 : -1}
        className="inline-flex h-6 w-12 items-center justify-center rounded-full border border-surface-gray bg-white text-ink-muted shadow-sm hover:bg-pco-blue hover:text-white hover:border-pco-blue transition-colors"
        aria-label={paraCima ? 'Rolar menu para cima' : 'Rolar menu para baixo'}
        title={paraCima ? 'Rolar para cima' : 'Rolar para baixo'}
      >
        {paraCima ? (
          <ChevronUp size={14} strokeWidth={2.5} />
        ) : (
          <ChevronDown size={14} strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
