import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, BookOpen, FileText, Newspaper, Mic2 } from 'lucide-react';
import { studentSearch } from '../data/api';
import type { StudentSearchHitDto } from '../data/api';

const TYPE_META: Record<
  StudentSearchHitDto['type'],
  { label: string; Icon: typeof BookOpen; color: string }
> = {
  course: { label: 'Curso', Icon: BookOpen, color: 'text-pco-blue' },
  lesson: { label: 'Aula', Icon: FileText, color: 'text-pco-cyan' },
  library: { label: 'Biblioteca', Icon: BookOpen, color: 'text-pco-orange' },
  news: { label: 'Notícia', Icon: Newspaper, color: 'text-pco-orange' },
  podcast: { label: 'Podcast', Icon: Mic2, color: 'text-pco-orange' },
};

/**
 * Search palette do aluno (Ctrl+K / Cmd+K). Busca em cursos, aulas, biblioteca,
 * news, podcasts via /api/search.
 */
export default function StudentSearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
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
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQ('');
      setActiveIdx(0);
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => studentSearch(q),
    enabled: open && q.trim().length >= 2,
    staleTime: 30_000,
  });

  function handleSelect(hit: StudentSearchHitDto) {
    setOpen(false);
    navigate(hit.link);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const list = data ?? [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && list[activeIdx]) {
      e.preventDefault();
      handleSelect(list[activeIdx]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-20 bg-black/40 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="pco-card w-full max-w-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-pco-border">
          <Search size={14} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar cursos, aulas, biblioteca..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {isFetching && <Loader2 size={12} className="animate-spin text-ink-muted" />}
          <kbd className="text-[10px] px-1.5 py-0.5 bg-surface-mute rounded text-ink-muted">
            Esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="p-6 text-center text-xs text-ink-subtle">
              Digite ao menos 2 caracteres
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-subtle">
              {isFetching ? 'Buscando...' : `Nenhum resultado para "${q}"`}
            </div>
          ) : (
            <ul>
              {data.map((hit, i) => {
                const meta = TYPE_META[hit.type];
                const Icon = meta.Icon;
                return (
                  <li key={`${hit.type}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(hit)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full text-left px-4 py-2.5 flex items-start gap-3 ${
                        i === activeIdx ? 'bg-pco-blue/10' : 'hover:bg-surface-mute'
                      }`}
                    >
                      <Icon size={14} className={`${meta.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-pco-deep truncate">
                          {hit.title}
                        </div>
                        {hit.snippet && (
                          <div className="text-[11px] text-ink-subtle line-clamp-1">
                            {hit.snippet}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-ink-subtle uppercase tracking-wide shrink-0">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-pco-border text-[10px] text-ink-subtle flex justify-between">
          <span>
            <kbd className="px-1 bg-surface-mute rounded">↑</kbd>{' '}
            <kbd className="px-1 bg-surface-mute rounded">↓</kbd> navegar
          </span>
          <span>
            <kbd className="px-1 bg-surface-mute rounded">Enter</kbd> abrir
          </span>
        </div>
      </div>
    </div>
  );
}
