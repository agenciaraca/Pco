import { BookOpen, Download, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLibrary, useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useT } from '../i18n';

type CourseFilter = 'all' | string;
type MandatoryFilter = 'all' | 'mandatory' | 'optional';
type TypeFilter = 'all' | 'pdf' | 'apostila' | 'leitura' | 'artigo';

export default function Library() {
  const t = useT();
  const { data: libraryItems = [], isLoading } = useLibrary();
  const { data: courses = [] } = useCourses();
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
  const [mandatoryFilter, setMandatoryFilter] = useState<MandatoryFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of libraryItems) {
      for (const t of it.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [libraryItems]);

  const filtered = useMemo(() => {
    return libraryItems.filter((item) => {
      if (courseFilter !== 'all') {
        if (!item.relatedCourseIds?.includes(courseFilter)) return false;
      }
      if (mandatoryFilter === 'mandatory' && !item.mandatory) return false;
      if (mandatoryFilter === 'optional' && item.mandatory) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (activeTag && !(item.tags ?? []).includes(activeTag)) return false;
      return true;
    });
  }, [libraryItems, courseFilter, mandatoryFilter, typeFilter, activeTag]);

  if (isLoading) return <CardListSkeleton count={4} />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('library.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Materiais, apostilas e leituras curadas pelos seus cursos.
        </p>
      </header>

      <div className="pco-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={courseFilter === 'all'}
            onClick={() => setCourseFilter('all')}
            label="Todos"
          />
          {courses.map((c) => (
            <FilterChip
              key={c.id}
              active={courseFilter === c.id}
              onClick={() => setCourseFilter(c.id)}
              label={c.shortTitle}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-surface-mute pt-3">
          <FilterChip
            active={mandatoryFilter === 'all'}
            onClick={() => setMandatoryFilter('all')}
            label="Tudo"
          />
          <FilterChip
            active={mandatoryFilter === 'mandatory'}
            onClick={() => setMandatoryFilter('mandatory')}
            label="Obrigatórios"
          />
          <FilterChip
            active={mandatoryFilter === 'optional'}
            onClick={() => setMandatoryFilter('optional')}
            label="Complementares"
          />
          <span className="mx-2 h-4 w-px bg-surface-gray" />
          {(['all', 'pdf', 'apostila', 'leitura', 'artigo'] as const).map((t) => (
            <FilterChip
              key={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              label={t === 'all' ? 'Qualquer tipo' : t.toUpperCase()}
            />
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[11px] text-ink-subtle uppercase mr-1">Tags:</span>
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`pco-badge text-xs ${
                activeTag === null
                  ? 'bg-pco-blue/10 text-pco-blue'
                  : 'bg-surface-gray text-ink-muted'
              }`}
            >
              Todas
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`pco-badge text-xs ${
                  activeTag === t
                    ? 'bg-pco-blue/10 text-pco-blue'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] text-ink-muted">
          <Filter size={11} strokeWidth={2} />
          {filtered.length} item{filtered.length === 1 ? '' : 's'} de {libraryItems.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum material com esses filtros"
          description="Limpe os filtros ou experimente outras combinações."
        />
      ) : (
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
                      {item.type}
                    </span>
                    {item.mandatory && (
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-pco-deep">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">por {item.author}</p>
                  {item.theme && (
                    <p className="mt-0.5 text-[11px] text-ink-subtle">{item.theme}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <a
                  href={item.fileMockUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="pco-btn-primary flex-1 justify-center text-xs"
                >
                  <Download size={12} strokeWidth={2} />
                  Abrir
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'pco-btn-secondary text-xs ring-2 ring-pco-blue'
          : 'pco-btn-ghost text-xs'
      }
    >
      {label}
    </button>
  );
}
