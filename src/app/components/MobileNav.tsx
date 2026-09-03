import { useEffect, useRef } from 'react';
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
  const painel = useRef<HTMLElement | null>(null);
  const botaoFechar = useRef<HTMLButtonElement | null>(null);

  // Esc fecha, e o foco entra no painel ao abrir. Sem isto, quem abre o menu
  // pelo teclado continua com o foco atrás dele.
  // `inert` via ref: os tipos do React 18 ainda nao conhecem o atributo, e
  // `aria-hidden` sozinho esconde do leitor de tela mas **nao** tira da ordem
  // de tabulacao — que e exatamente o problema aqui.
  useEffect(() => {
    const el = painel.current;
    if (!el) return;
    if (open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    botaoFechar.current?.focus();
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Prende o foco dentro do painel enquanto ele está aberto.
      if (e.key !== 'Tab' || !painel.current) return;
      const focaveis = painel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-40 bg-pco-deep/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      {/*
        `inert` quando fechado. O painel fica sempre montado e só é empurrado
        para fora com `-translate-x-full` — o que o tira da tela e **não** o
        tira da ordem de tabulação. Abaixo de 1024px, os ~15 links continuavam
        focáveis com o menu fechado: quem navega por teclado (ou por foco no
        Android) tabulava por um menu invisível antes de chegar ao conteúdo.
        Era o pior problema de ordem de foco do produto, no dispositivo em que
        está a maior parte destes alunos.
      */}
      <aside
        ref={painel}
        {...(open ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Menu' } : {})}
        aria-hidden={!open ? true : undefined}
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-surface-gray transition-transform duration-300 ease-smooth lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-gray">
          <Logo />
          <button
            ref={botaoFechar}
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
              <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
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
