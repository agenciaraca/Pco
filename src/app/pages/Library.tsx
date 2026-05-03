import { BookOpen, Download, Star } from 'lucide-react';
import { useLibrary, useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';

export default function Library() {
  const { data: libraryItems = [], isLoading } = useLibrary();
  const { data: courses = [] } = useCourses();

  if (isLoading) return <CardListSkeleton count={4} />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Biblioteca PCO</h1>
        <p className="pco-section-subtitle mt-1">
          Materiais, apostilas e leituras curadas pelos seus cursos.
        </p>
      </header>

      <div className="pco-card p-4">
        <div className="flex flex-wrap gap-2">
          <button className="pco-btn-secondary text-xs">Todos</button>
          {courses.map((c) => (
            <button key={c.id} className="pco-btn-ghost text-xs">
              {c.shortTitle}
            </button>
          ))}
          <button className="pco-btn-ghost text-xs">Obrigatórios</button>
          <button className="pco-btn-ghost text-xs">Complementares</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {libraryItems.map((item) => (
          <div key={item.id} className="pco-card pco-card-hover">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 grid place-items-center">
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
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="pco-btn-primary flex-1 justify-center text-xs">
                <Download size={12} strokeWidth={2} />
                Baixar
              </button>
              <button className="pco-btn-ghost text-xs px-3">
                <Star size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
