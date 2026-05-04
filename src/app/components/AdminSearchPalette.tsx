import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminSearch } from '../data/api';
import type { SearchHitDto } from '../data/api';

const TYPE_LABELS: Record<SearchHitDto['type'], string> = {
  course: 'Curso',
  module: 'Módulo',
  lesson: 'Aula',
  library: 'Biblioteca',
  news: 'Notícia',
  podcast: 'Podcast',
  user: 'Usuário',
  order: 'Pedido',
  product: 'Produto',
};

const TYPE_COLORS: Record<SearchHitDto['type'], string> = {
  course: 'bg-pco-blue/10 text-pco-blue',
  module: 'bg-pco-blue/10 text-pco-blue',
  lesson: 'bg-pco-cyan/15 text-pco-cyan',
  library: 'bg-pco-orange/10 text-pco-orange',
  news: 'bg-pco-orange/10 text-pco-orange',
  podcast: 'bg-pco-orange/10 text-pco-orange',
  user: 'bg-status-success/10 text-status-success',
  order: 'bg-pco-cyan/15 text-pco-cyan',
  product: 'bg-pco-blue/10 text-pco-blue',
};

export default function AdminSearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Atalho Ctrl+K / Cmd+K para abrir
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useQuery({
    queryKey: ['admin', 'palette', q] as const,
    queryFn: () => adminSearch(q),
    enabled: q.trim().length >= 2,
  });

  const hits = search.data ?? [];

  function handleSelect(hit: SearchHitDto) {
    setOpen(false);
    navigate(hit.link);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[activeIdx];
      if (hit) handleSelect(hit);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-pco-border text-xs text-ink-muted hover:bg-surface-mute"
        title="Buscar (Ctrl+K)"
      >
        <Search size={12} strokeWidth={1.75} />
        Buscar
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-surface-gray text-[10px] font-mono">
          Ctrl K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-24 px-4 bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-pco-border">
          <Search size={16} className="text-ink-subtle" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKey}
            placeholder="Buscar cursos, alunos, pedidos, produtos..."
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {search.isFetching && q.length >= 2 && (
            <Loader2 size={14} className="animate-spin text-ink-subtle" />
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-ink-subtle hover:text-pco-deep"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {q.length < 2 && (
            <div className="p-6 text-center text-xs text-ink-muted">
              Digite pelo menos 2 caracteres. Atalho:{' '}
              <kbd className="px-1 bg-surface-gray rounded">↑</kbd>
              <kbd className="px-1 bg-surface-gray rounded">↓</kbd>
              <kbd className="px-1 bg-surface-gray rounded">Enter</kbd>
            </div>
          )}
          {q.length >= 2 && hits.length === 0 && !search.isFetching && (
            <div className="p-6 text-center text-xs text-ink-muted">Sem resultados.</div>
          )}
          {hits.map((h, i) => (
            <button
              type="button"
              key={`${h.type}-${h.id}`}
              onClick={() => handleSelect(h)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 ${
                i === activeIdx ? 'bg-pco-blue/5' : ''
              } hover:bg-pco-blue/5`}
            >
              <span
                className={`pco-badge ${TYPE_COLORS[h.type]} shrink-0 mt-0.5 text-[10px]`}
              >
                {TYPE_LABELS[h.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-pco-deep truncate">
                  {h.title}
                </div>
                {h.snippet && (
                  <div className="text-[11px] text-ink-muted truncate">{h.snippet}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
