import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StickyNote, Search, ArrowRight, BookOpen, Download } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useMyNotes } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import MarkdownLite from '../components/MarkdownLite';

export default function MyNotes() {
  useDocumentMeta({ title: 'Minhas anotações — AVA PCO' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useMyNotes(search || undefined);
  const toast = useToast();

  async function handleExport() {
    const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
    const token = session?.token;
    try {
      const res = await fetch('/api/me/notes/export.md', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anotacoes-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Anotações exportadas');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  function handleSearch() {
    setSearch(searchInput.trim());
  }

  function highlight(content: string, query: string): string {
    if (!query) return content;
    // Trunca pra preview (200 chars centrados na primeira ocorrência)
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return content.slice(0, 300);
    const start = Math.max(0, idx - 80);
    const end = Math.min(content.length, idx + query.length + 200);
    return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title flex items-center gap-2">
            <StickyNote size={20} className="text-pco-blue" strokeWidth={1.75} />
            Minhas anotações
          </h1>
          <p className="pco-section-subtitle mt-1">
            Tudo que você anotou nas aulas em um só lugar. Use a busca para
            encontrar trechos rapidamente.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={(data ?? []).length === 0}
          className="pco-btn-ghost text-xs"
          title="Baixar todas as anotações em markdown"
        >
          <Download size={11} strokeWidth={2} />
          Exportar .md
        </button>
      </header>

      <div className="pco-card p-3 flex items-center gap-2">
        <Search size={14} className="text-ink-muted" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar nas suas anotações..."
          className="pco-input text-sm flex-1"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="pco-btn-primary text-xs"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSearchInput('');
            }}
            className="pco-btn-ghost text-xs"
          >
            Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title={search ? 'Nada encontrado' : 'Sem anotações'}
          description={
            search
              ? `Nenhuma anotação contém "${search}".`
              : 'Suas anotações nas aulas aparecerão aqui.'
          }
          icon={<BookOpen size={28} className="text-pco-blue" />}
        />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((n) => (
            <li key={`${n.courseId}-${n.lessonId}`} className="pco-card pco-card-hover p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="text-[11px] uppercase tracking-wide text-ink-subtle">
                    {n.courseTitle} · {n.moduleTitle}
                  </div>
                  <div className="font-semibold text-pco-deep mt-0.5">
                    {n.lessonTitle}
                  </div>
                  <div className="mt-2 text-xs text-ink-muted bg-surface-mute rounded p-2 max-h-40 overflow-y-auto">
                    <MarkdownLite source={highlight(n.content, search)} />
                  </div>
                  <div className="text-[10px] text-ink-subtle mt-1">
                    Atualizado em {new Date(n.updatedAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <Link
                  to={`/curso/${n.courseId}/modulo/${n.moduleId}/aula/${n.lessonId}`}
                  className="pco-btn-ghost text-xs"
                >
                  Abrir aula
                  <ArrowRight size={11} strokeWidth={2} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
