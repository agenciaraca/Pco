import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit3,
  Trash2,
  Star,
  Download,
} from 'lucide-react';
import { libraryItems, courses } from '../../data/seed';

const typeLabels: Record<string, string> = {
  pdf: 'PDF',
  apostila: 'Apostila',
  leitura: 'Leitura',
  artigo: 'Artigo',
};

export default function AdminLibrary() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [courseFilter, setCourseFilter] = useState('todos');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = [...libraryItems];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'todos') list = list.filter((i) => i.type === typeFilter);
    if (courseFilter !== 'todos')
      list = list.filter((i) => i.relatedCourseIds?.includes(courseFilter));
    if (mandatoryOnly) list = list.filter((i) => i.mandatory);
    return list;
  }, [search, typeFilter, courseFilter, mandatoryOnly]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Biblioteca PCO — Admin</h1>
          <p className="pco-section-subtitle mt-1">
            Cadastro e curadoria de materiais, apostilas e leituras.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo material
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={libraryItems.length} />
        <Stat
          label="Obrigatórios"
          value={libraryItems.filter((i) => i.mandatory).length}
          accent="orange"
        />
        <Stat
          label="Apostilas"
          value={libraryItems.filter((i) => i.type === 'apostila').length}
        />
        <Stat label="PDFs" value={libraryItems.filter((i) => i.type === 'pdf').length} />
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
            placeholder="Buscar título ou autor..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os tipos</option>
          <option value="pdf">PDF</option>
          <option value="apostila">Apostila</option>
          <option value="leitura">Leitura</option>
          <option value="artigo">Artigo</option>
        </select>
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
            checked={mandatoryOnly}
            onChange={(e) => setMandatoryOnly(e.target.checked)}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          Apenas obrigatórios
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div key={item.id} className="pco-card pco-card-hover">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 grid place-items-center shrink-0">
                <BookOpen size={20} className="text-pco-blue" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="pco-badge bg-pco-blue/10 text-pco-blue uppercase">
                    {typeLabels[item.type]}
                  </span>
                  {item.mandatory && (
                    <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                      Obrigatório
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-pco-deep">{item.title}</h3>
                <p className="text-xs text-ink-muted">por {item.author}</p>
                {item.relatedCourseIds && item.relatedCourseIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.relatedCourseIds.map((cid) => {
                      const c = courses.find((co) => co.id === cid);
                      return c ? (
                        <span key={cid} className="pco-badge bg-surface-gray text-ink-muted">
                          {c.shortTitle}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="pco-btn-secondary text-xs flex-1 justify-center">
                <Edit3 size={12} strokeWidth={1.75} />
                Editar
              </button>
              <button className="pco-btn-ghost text-xs px-2.5">
                <Star size={12} strokeWidth={1.75} />
              </button>
              <button className="pco-btn-ghost text-xs px-2.5">
                <Download size={12} strokeWidth={1.75} />
              </button>
              <button className="pco-btn-ghost text-xs px-2.5 text-status-danger">
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 pco-card text-center py-10">
            <p className="text-sm text-ink-muted">Nenhum material encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'orange';
}) {
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent === 'orange' ? 'text-pco-orange' : 'text-pco-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
