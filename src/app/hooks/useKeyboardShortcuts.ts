// Atalhos de teclado globais pro admin (estilo Gmail/Notion).
// Sequências de 2 letras: g+d (dashboard), g+u (alunos), g+c (cursos), etc.
// "?" abre help modal listando todos os atalhos.
//
// Ignora se foco está em input/textarea/select ou contenteditable.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardShortcutsOptions {
  /** Quando true, abre o modal de help (?). */
  onShowHelp?: () => void;
  /** Quando true, focar campo de busca global. Default: dispara Ctrl+K. */
  onFocusSearch?: () => void;
  /** Desabilita todos atalhos enquanto true (ex: durante modal). */
  disabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

export const ADMIN_SHORTCUTS: Array<{ keys: string; label: string; to: string }> = [
  { keys: 'g d', label: 'Ir para Dashboard', to: '/admin/dashboard' },
  { keys: 'g u', label: 'Ir para Alunos', to: '/admin/alunos' },
  { keys: 'g c', label: 'Ir para Cursos', to: '/admin/cursos' },
  { keys: 'g p', label: 'Ir para Pedidos', to: '/admin/pedidos' },
  { keys: 'g e', label: 'Ir para E-mail', to: '/admin/email' },
  { keys: 'g w', label: 'Ir para Webhooks', to: '/admin/webhooks' },
  { keys: 'g r', label: 'Ir para Evasão (retention)', to: '/admin/evasao' },
  { keys: 'g s', label: 'Ir para Saúde', to: '/admin/saude' },
  { keys: 'g a', label: 'Ir para Auditoria', to: '/admin/auditoria' },
  { keys: 'g b', label: 'Ir para Backups', to: '/admin/backups' },
];

export function useAdminKeyboardShortcuts(opts: UseKeyboardShortcutsOptions = {}): void {
  const navigate = useNavigate();
  const lastG = useRef<number>(0);

  useEffect(() => {
    if (opts.disabled) return;
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // outros já tratados

      const k = e.key.toLowerCase();

      // ? abre help
      if (k === '?' || (e.shiftKey && k === '/')) {
        e.preventDefault();
        opts.onShowHelp?.();
        return;
      }

      // "/" foca search
      if (k === '/') {
        e.preventDefault();
        opts.onFocusSearch?.();
        return;
      }

      // Sequência "g X"
      const now = Date.now();
      if (k === 'g') {
        lastG.current = now;
        return;
      }
      if (now - lastG.current < 1000 && lastG.current > 0) {
        const match = ADMIN_SHORTCUTS.find((s) => s.keys === `g ${k}`);
        if (match) {
          e.preventDefault();
          lastG.current = 0;
          navigate(match.to);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, opts]);
}
