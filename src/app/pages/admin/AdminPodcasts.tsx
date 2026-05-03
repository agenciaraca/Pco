import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Mic2,
  Edit3,
  Trash2,
  PlayCircle,
  Heart,
  Clock,
} from 'lucide-react';
import { podcasts, courses } from '../../data/seed';

export default function AdminPodcasts() {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('todos');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = [...podcasts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }
    if (courseFilter !== 'todos')
      list = list.filter((p) => p.relatedCourseIds?.includes(courseFilter));
    if (favoritesOnly) list = list.filter((p) => p.favorite);
    return list;
  }, [search, courseFilter, favoritesOnly]);

  const totalMinutes = podcasts.reduce((s, p) => s + p.durationMinutes, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">PCO POD — Admin</h1>
          <p className="pco-section-subtitle mt-1">
            Gestão dos episódios do podcast pedagógico.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo episódio
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Episódios" value={podcasts.length.toString()} />
        <Stat label="Duração total" value={`${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}min`} />
        <Stat label="Favoritos" value={podcasts.filter((p) => p.favorite).length.toString()} />
      </div>

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
            placeholder="Buscar episódio..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os cursos</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortTitle}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          Apenas favoritos
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((p) => (
          <article key={p.id} className="pco-card pco-card-hover">
            <div className="flex gap-4">
              <div
                className={`h-20 w-20 rounded-xl bg-gradient-to-br ${p.coverColor} grid place-items-center shrink-0`}
              >
                <Mic2 size={26} className="text-white" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {p.favorite && (
                    <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                      <Heart size={10} strokeWidth={2} />
                      Favorito
                    </span>
                  )}
                  {p.relatedCourseIds?.map((cid) => {
                    const c = courses.find((co) => co.id === cid);
                    return c ? (
                      <span key={cid} className="pco-badge bg-pco-blue/10 text-pco-blue">
                        {c.shortTitle}
                      </span>
                    ) : null;
                  })}
                </div>
                <h3 className="text-base font-semibold text-pco-deep line-clamp-1">{p.title}</h3>
                <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{p.description}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    {p.durationMinutes} min
                  </span>
                  <span>{new Date(p.publishedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="pco-btn-secondary text-xs flex-1 justify-center">
                <PlayCircle size={12} strokeWidth={2} />
                Pré-ouvir
              </button>
              <button className="pco-btn-ghost text-xs">
                <Edit3 size={12} strokeWidth={1.75} />
                Editar
              </button>
              <button className="pco-btn-ghost text-xs px-2.5 text-status-danger">
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
    </div>
  );
}
