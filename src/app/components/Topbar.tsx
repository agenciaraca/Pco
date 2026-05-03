import { Link } from 'react-router-dom';
import { Bell, Search, Menu } from 'lucide-react';
import { currentStudent } from '../data/seed';

interface TopbarProps {
  onMenuClick?: () => void;
  variant?: 'student' | 'admin';
}

export default function Topbar({ onMenuClick, variant = 'student' }: TopbarProps) {
  const initials = currentStudent.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-surface-gray">
      <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
        <button
          onClick={onMenuClick}
          className="lg:hidden -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-gray transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>

        <div className="flex-1 max-w-xl hidden md:block">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              size={16}
              strokeWidth={1.75}
            />
            <input
              type="text"
              placeholder={
                variant === 'admin'
                  ? 'Buscar alunos, cursos, materiais...'
                  : 'Buscar aulas, materiais, podcasts...'
              }
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-gray bg-surface-off text-ink-base placeholder:text-ink-subtle focus:outline-none focus:bg-white focus:border-pco-blue focus:ring-2 focus:ring-pco-blue/15 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 md:hidden" />

        <Link
          to="/notificacoes"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-gray transition-colors"
          aria-label="Notificações"
        >
          <Bell size={18} strokeWidth={1.75} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-pco-orange ring-2 ring-white" />
        </Link>

        <Link
          to="/perfil"
          className="flex items-center gap-2.5 rounded-xl pl-1 pr-3 py-1 hover:bg-surface-gray transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white shadow-soft">
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <div className="text-xs font-semibold text-pco-deep truncate max-w-[120px]">
              {currentStudent.name}
            </div>
            <div className="text-[10px] text-ink-subtle">
              {variant === 'admin' ? 'Admin' : 'Aluno'}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
