import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Bell, Search, Menu, LogOut, UserCircle2, Settings as SettingsIcon, ShieldOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../data/hooks';

interface TopbarProps {
  onMenuClick?: () => void;
  variant?: 'student' | 'admin';
}

export default function Topbar({ onMenuClick, variant = 'student' }: TopbarProps) {
  const { user, logout, logoutAllDevices } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const name = user?.name ?? 'Aluno';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLogoutAll = async () => {
    if (!confirm('Encerrar sessões em TODOS os dispositivos?\n\nVocê precisará fazer login novamente.')) {
      return;
    }
    await logoutAllDevices();
    navigate('/login');
  };

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
          {unread.data && unread.data.count > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-pco-orange text-[9px] font-bold text-white grid place-items-center ring-2 ring-white">
              {unread.data.count > 99 ? '99+' : unread.data.count}
            </span>
          ) : null}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl pl-1 pr-3 py-1 hover:bg-surface-gray transition-colors"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white shadow-soft">
              {initials}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold text-pco-deep truncate max-w-[120px]">
                {name}
              </div>
              <div className="text-[10px] text-ink-subtle">
                {variant === 'admin' ? 'Admin' : 'Aluno'}
              </div>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 pco-card p-1 shadow-lift animate-in" role="menu">
              <div className="px-3 py-2 border-b border-surface-gray mb-1">
                <div className="text-xs font-semibold text-pco-deep truncate">{name}</div>
                {user?.email && (
                  <div className="text-[11px] text-ink-subtle truncate">{user.email}</div>
                )}
              </div>
              <Link
                to="/perfil"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-off hover:text-pco-deep"
              >
                <UserCircle2 size={14} strokeWidth={1.75} />
                Meu perfil
              </Link>
              <Link
                to={variant === 'admin' ? '/admin/configuracoes' : '/perfil'}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-off hover:text-pco-deep"
              >
                <SettingsIcon size={14} strokeWidth={1.75} />
                Configurações
              </Link>
              {variant !== 'admin' && user?.role === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-pco-blue hover:bg-pco-blue/10"
                >
                  Acessar área admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-status-danger hover:bg-status-danger/10"
              >
                <LogOut size={14} strokeWidth={1.75} />
                Sair
              </button>
              <button
                onClick={handleLogoutAll}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-muted hover:bg-surface-off hover:text-status-danger"
                title="Encerra a sessão em todos os dispositivos"
              >
                <ShieldOff size={12} strokeWidth={1.75} />
                Sair de todos os dispositivos
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
