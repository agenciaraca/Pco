import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import {
  useCourses,
  useCurrentStudent,
  useProducts,
} from '../data/hooks';
import type { ProductDto } from '../data/api';

/**
 * Sugere cursos com base em tags compartilhadas com cursos já matriculados.
 * Filtra cursos com produto ativo (não-matriculados). Mostra até 3.
 */
export default function SuggestedCourses() {
  const { data: courses } = useCourses();
  const { data: student } = useCurrentStudent();
  const { data: products = [] } = useProducts();

  const suggestions = useMemo(() => {
    if (!courses || courses.length === 0) return [];
    const enrolledIds = new Set(
      (student as { enrolledCourseIds?: string[] })?.enrolledCourseIds ?? [],
    );
    if (enrolledIds.size === 0) return [];

    // Tags dos cursos matriculados
    const myTags = new Set<string>();
    for (const c of courses) {
      if (enrolledIds.has(c.id)) {
        for (const t of c.tags ?? []) myTags.add(t);
      }
    }
    if (myTags.size === 0) return [];

    // Cursos não-matriculados com produto ativo, ranqueados por overlap de tags
    const candidates = courses
      .filter((c) => !enrolledIds.has(c.id))
      .map((c) => {
        const product = products.find(
          (p): p is ProductDto =>
            p.kind === 'course' && p.refId === c.id && p.active,
        );
        if (!product) return null;
        const overlap = (c.tags ?? []).filter((t) => myTags.has(t)).length;
        return overlap > 0 ? { course: c, product, overlap } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);

    return candidates;
  }, [courses, student, products]);

  if (suggestions.length === 0) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
        <Sparkles size={16} className="text-pco-blue" strokeWidth={1.75} />
        Cursos que você pode gostar
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {suggestions.map(({ course, product, overlap }) => {
          const price = (product.priceCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: product.currency,
          });
          return (
            <Link
              key={course.id}
              to={`/curso-preview/${course.id}`}
              className="pco-card pco-card-hover p-0 overflow-hidden block"
            >
              <div
                className={`relative h-24 p-3 ${course.coverImageUrl ? 'bg-pco-deep' : `bg-gradient-to-br ${course.coverColor}`}`}
              >
                {course.coverImageUrl && (
                  <img src={course.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
                <div className="relative text-white">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-[9px] font-semibold uppercase tracking-wider">
                    {course.shortTitle}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <h3 className="text-sm font-semibold text-pco-deep line-clamp-2">
                  {course.title}
                </h3>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-subtle">
                    {overlap} tag{overlap > 1 ? 's' : ''} em comum
                  </span>
                  <span className="font-bold text-pco-deep">{price}</span>
                </div>
                <span className="inline-flex items-center text-[11px] text-pco-blue">
                  Ver detalhes
                  <ArrowRight size={11} className="ml-0.5" strokeWidth={2} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
