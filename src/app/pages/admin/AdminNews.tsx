import { useState, useMemo } from 'react';
import { Plus, Search, Edit3, Trash2, Star, Eye, Calendar } from 'lucide-react';
import { newsArticles, courses } from '../../data/seed';

export default function AdminNews() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(newsArticles.map((a) => a.category))),
    [],
  );

  const filtered = useMemo(() => {
    let list = [...newsArticles];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== 'todos') list = list.filter((a) => a.category === categoryFilter);
    if (featuredOnly) list = list.filter((a) => a.featured);
    return list;
  }, [search, categoryFilter, featuredOnly]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">PCO News — Admin</h1>
          <p className="pco-section-subtitle mt-1">
            Criação, curadoria e agendamento de artigos.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo artigo
        </button>
      </header>

      <div className="pco-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            size={14}
            strokeWidth={1.75}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => setFeaturedOnly(e.target.checked)}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          Apenas destaques
        </label>
      </div>

      <div className="pco-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-off">
              <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <th className="px-4 py-3 text-left font-medium">Artigo</th>
                <th className="px-4 py-3 text-left font-medium">Categoria</th>
                <th className="px-4 py-3 text-left font-medium">Curso</th>
                <th className="px-4 py-3 text-left font-medium">Autor</th>
                <th className="px-4 py-3 text-left font-medium">Publicação</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-surface-gray hover:bg-surface-off">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${a.coverColor} shrink-0`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-pco-deep">{a.title}</span>
                          {a.featured && (
                            <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                              <Star size={10} strokeWidth={2} />
                              Destaque
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-subtle line-clamp-1 max-w-md">
                          {a.excerpt}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="pco-badge bg-pco-blue/10 text-pco-blue">{a.category}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {a.relatedCourseIds && a.relatedCourseIds.length > 0
                      ? courses.find((c) => c.id === a.relatedCourseIds![0])?.shortTitle
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{a.authorName}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(a.publishedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button className="pco-btn-ghost text-xs px-2.5" title="Ver">
                        <Eye size={12} strokeWidth={1.75} />
                      </button>
                      <button className="pco-btn-ghost text-xs px-2.5" title="Editar">
                        <Edit3 size={12} strokeWidth={1.75} />
                      </button>
                      <button
                        className="pco-btn-ghost text-xs px-2.5 text-status-danger"
                        title="Excluir"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Nenhum artigo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
