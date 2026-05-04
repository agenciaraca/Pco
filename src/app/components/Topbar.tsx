import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Search,
  Menu,
  LogOut,
  UserCircle2,
  Settings as SettingsIcon,
  ShieldOff,
  Loader2,
  GraduationCap,
  Layers,
  PlayCircle,
  BookOpen,
  Newspaper,
  Mic2,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../data/hooks';
import { useToast } from './Toast';
import * as api from '../data/api';

interface TopbarProps {
  onMenuClick?: () => void;
  variant?: 'student' | 'admin';
}

const TYPE_ICONS: Record<api.SearchHitDto['type'], typeof Search> = {
  course: GraduationCap,
  module: Layers,
  lesson: PlayCircle,
  library: BookOpen,
  news: Newspaper,
  podcast: Mic2,
  user: UserIcon,
};

export default function Topbar({ onMenuClick, variant = 'student' }: TopbarProps) {
  const { user, logout, logoutAllDevices } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const toast = useToast();
  const lastUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    const current = unread.data?.count ?? 0;
    const last = lastUnreadRef.current;
    if (last !== null && current > last) {
      const delta = current - last;
      toast.info(
        delta === 1 ? 'Nova notificação' : `${delta} novas notificações`,
        'Clique no sino para visualizar.',
      );
    }
    lastUnreadRef.current = current;
  }, [unread.data?.count, toast]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<api.SearchHitDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const hits =
          variant === 'admin' ? await api.adminSearch(searchQ) : await api.studentSearch(searchQ);
        if (!cancelled) setSearchResults(hits as api.SearchHitDto[]);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQ, variant]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    if (searchOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  // Atalhos de teclado: Cmd/Ctrl+K foca a busca; ? abre modal de atalhos
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setSearchOpen(true);
        return;
      }
      if (e.key === '?' && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setShortcutsOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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

        <div className="flex-1 max-w-xl hidden md:block relative" ref={searchRef}>
          <div className="relative">
            {searching ? (
              <Loader2
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle animate-spin"
                size={16}
                strokeWidth={1.75}
              />
            ) : (
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                size={16}
                strokeWidth={1.75}
              />
            )}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder={
                variant === 'admin'
                  ? 'Buscar alunos, cursos, materiais... (Ctrl+K)'
                  : 'Buscar aulas, materiais, podcasts... (Ctrl+K)'
              }
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-gray bg-surface-off text-ink-base placeholder:text-ink-subtle focus:outline-none focus:bg-white focus:border-pco-blue focus:ring-2 focus:ring-pco-blue/15 transition-all"
            />
          </div>
          {searchOpen && searchQ.trim().length >= 2 && (
            <div className="absolute top-full mt-2 left-0 right-0 pco-card shadow-lift max-h-[420px] overflow-auto z-40">
              {searchResults.length === 0 ? (
                <div className="text-xs text-ink-muted px-4 py-6 text-center">
                  {searching ? 'Buscando...' : 'Nenhum resultado'}
                </div>
              ) : (
                <ul className="divide-y divide-surface-mute">
                  {searchResults.map((h) => {
                    const Icon = TYPE_ICONS[h.type] ?? Search;
                    return (
                      <li key={`${h.type}-${h.id}`}>
                        <Link
                          to={h.link}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQ('');
                          }}
                          className="flex items-start gap-2 px-3 py-2 hover:bg-surface-off"
                        >
                          <Icon size={14} strokeWidth={2} className="mt-0.5 text-pco-blue shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-pco-deep truncate">
                              <Highlight text={h.title} query={searchQ} />
                            </div>
                            {h.snippet && (
                              <div className="text-xs text-ink-muted truncate">
                                <Highlight text={h.snippet} query={searchQ} />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-ink-subtle shrink-0 mt-1">
                            {h.type}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
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
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={name}
                className="h-8 w-8 rounded-full object-cover shadow-soft"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white shadow-soft">
                {initials}
              </div>
            )}
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

      {shortcutsOpen && (
        <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
      )}
    </header>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const items = [
    { keys: ['Ctrl', 'K'], action: 'Focar busca global' },
    { keys: ['?'], action: 'Abrir esta lista de atalhos' },
    { keys: ['Esc'], action: 'Fechar diálogos' },
  ];
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Atalhos
            </div>
            <h2 className="text-lg font-bold text-pco-deep">Teclado</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li key={it.action} className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-muted">{it.action}</span>
              <span className="flex items-center gap-1">
                {it.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded border border-surface-gray bg-surface-off text-xs font-mono text-pco-deep"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-ink-subtle">
          Em Mac, use <kbd className="px-1.5 rounded bg-surface-gray text-[10px]">⌘</kbd> em
          vez de <kbd className="px-1.5 rounded bg-surface-gray text-[10px]">Ctrl</kbd>.
        </p>
      </div>
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;
  const pattern = new RegExp(`(${escapeRegex(q)})`, 'i');
  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark
            key={i}
            className="bg-status-gold/30 text-pco-deep rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
