// Compara até 4 cursos lado a lado. URL: /comparar?ids=14839,8495,8748
// Útil pro aluno decidir qual matricular.

import { useSearchParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Award,
  Users,
  Lock,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useCourses, useAdminCoursesSummary } from '../data/hooks';
import { isPubliclyListed } from '../../../shared/visibilidade';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const MAX_COMPARE = 4;

export default function CompareCourses() {
  useDocumentMeta({ title: 'Comparar cursos — AVA PCO' });
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  const { data: allCourses, isLoading } = useCourses();
  const summaryQ = useAdminCoursesSummary();
  const summaryById = useMemo(
    () => new Map((summaryQ.data ?? []).map((s) => [s.courseId, s])),
    [summaryQ.data],
  );

  const courses = useMemo(() => {
    if (!allCourses) return [];
    return ids
      .map((id) => allCourses.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      // Esta rota é pública e resolve qualquer id que venha na URL. Sem o
      // portão, quem soubesse o id de um curso tirado da vitrine via a página
      // de comparação dele — o mesmo furo que o catálogo tinha.
      .filter(isPubliclyListed);
  }, [allCourses, ids]);

  function removeId(id: string) {
    const next = ids.filter((x) => x !== id);
    if (next.length === 0) {
      setSearchParams({});
    } else {
      setSearchParams({ ids: next.join(',') });
    }
  }

  function addId(id: string) {
    if (ids.includes(id)) return;
    if (ids.length >= MAX_COMPARE) return;
    setSearchParams({ ids: [...ids, id].join(',') });
  }

  if (isLoading) return <CardListSkeleton count={3} />;

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <Link
            to="/catalogo"
            className="text-xs font-medium text-pco-blue inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft size={12} /> Voltar ao catálogo
          </Link>
          <h1 className="pco-section-title mt-2">Comparar cursos</h1>
          <p className="pco-section-subtitle mt-1">
            Adicione cursos abaixo (até {MAX_COMPARE}) pra ver lado a lado.
          </p>
        </header>
        <div className="pco-card">
          <EmptyState
            title="Nenhum curso selecionado"
            description="Escolha cursos do catálogo pra comparar."
          />
        </div>
        <CoursePicker
          all={allCourses ?? []}
          selected={[]}
          onPick={addId}
          maxReached={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/catalogo"
          className="text-xs font-medium text-pco-blue inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft size={12} /> Voltar ao catálogo
        </Link>
        <h1 className="pco-section-title mt-2">
          Comparar {courses.length} curso{courses.length > 1 ? 's' : ''}
        </h1>
        <p className="pco-section-subtitle mt-1">
          Adicione até {MAX_COMPARE} cursos pra comparar lado a lado.
        </p>
      </header>

      <div className="pco-card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-off">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider text-ink-subtle w-48">
                Característica
              </th>
              {courses.map((c) => (
                <th
                  key={c.id}
                  className="text-left px-4 py-3 align-top min-w-[200px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-pco-deep">
                        {c.shortTitle}
                      </div>
                      <div className="text-[11px] text-ink-subtle">/{c.slug}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeId(c.id)}
                      className="text-ink-muted hover:text-status-danger"
                      aria-label={`Remover ${c.title} da comparação`}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-gray">
            <Row label="Capa">
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3">
                  <div className="relative h-20 rounded-lg overflow-hidden">
                    {c.coverImageUrl ? (
                      <img
                        src={c.coverImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${c.coverColor}`} />
                    )}
                  </div>
                </td>
              ))}
            </Row>
            <Row label="Módulos" icon={<Layers size={12} className="text-pco-blue" />}>
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3 text-pco-deep font-semibold tabular-nums">
                  {c.modules.length}
                </td>
              ))}
            </Row>
            <Row label="Aulas">
              {courses.map((c) => {
                const lessons = c.modules.reduce((s, m) => s + m.lessons.length, 0);
                return (
                  <td key={c.id} className="px-4 py-3 text-pco-deep font-semibold tabular-nums">
                    {lessons}
                  </td>
                );
              })}
            </Row>
            <Row label="Carga horária" icon={<Clock size={12} className="text-pco-blue" />}>
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3 text-pco-deep font-semibold tabular-nums">
                  {c.totalHours}h
                </td>
              ))}
            </Row>
            <Row label="Certificado" icon={<Award size={12} className="text-status-gold" />}>
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3">
                  {c.certificateAvailable ? (
                    <span className="text-status-success inline-flex items-center gap-1">
                      <CheckCircle2 size={14} strokeWidth={2} /> Sim
                    </span>
                  ) : (
                    <span className="text-ink-subtle inline-flex items-center gap-1">
                      <XCircle size={14} strokeWidth={2} /> Não
                    </span>
                  )}
                </td>
              ))}
            </Row>
            <Row label="Alunos inscritos" icon={<Users size={12} className="text-pco-cyan" />}>
              {courses.map((c) => {
                const sum = summaryById.get(c.id);
                return (
                  <td key={c.id} className="px-4 py-3 text-ink-muted tabular-nums">
                    {sum?.enrolledCount ?? 0}
                  </td>
                );
              })}
            </Row>
            <Row label="Pré-requisitos" icon={<Lock size={12} className="text-pco-orange" />}>
              {courses.map((c) => {
                const reqs = c.prerequisiteCourseIds ?? [];
                return (
                  <td key={c.id} className="px-4 py-3 text-xs text-ink-muted">
                    {reqs.length === 0 ? (
                      <span className="text-ink-subtle">—</span>
                    ) : (
                      <span>{reqs.length} curso{reqs.length === 1 ? '' : 's'}</span>
                    )}
                  </td>
                );
              })}
            </Row>
            <Row label="Instrutor">
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3 text-xs text-ink-muted">
                  {c.instructorName || <span className="text-ink-subtle">—</span>}
                </td>
              ))}
            </Row>
            <Row label="Descrição">
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3 text-xs text-ink-muted">
                  <p className="line-clamp-4">{c.description}</p>
                </td>
              ))}
            </Row>
            <tr>
              <td className="px-4 py-3"></td>
              {courses.map((c) => (
                <td key={c.id} className="px-4 py-3">
                  <Link
                    to={`/cursos/${c.slug}`}
                    className="pco-btn-primary text-xs w-full justify-center"
                  >
                    Ver detalhes
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {courses.length < MAX_COMPARE && (
        <CoursePicker
          all={allCourses ?? []}
          selected={ids}
          onPick={addId}
          maxReached={false}
        />
      )}
    </div>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted bg-surface-off/50">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </th>
      {children}
    </tr>
  );
}

function CoursePicker({
  all,
  selected,
  onPick,
  maxReached,
}: {
  all: Array<{ id: string; title: string; shortTitle: string }>;
  selected: string[];
  onPick: (id: string) => void;
  maxReached: boolean;
}) {
  const available = all.filter((c) => !selected.includes(c.id));
  return (
    <div className="pco-card">
      <h3 className="text-sm font-semibold text-pco-deep mb-3">
        Adicionar curso à comparação{' '}
        <span className="text-[11px] text-ink-subtle font-normal">
          (até {MAX_COMPARE})
        </span>
      </h3>
      {maxReached || selected.length >= MAX_COMPARE ? (
        <p className="text-xs text-ink-muted">
          Limite de {MAX_COMPARE} cursos atingido. Remova um pra adicionar outro.
        </p>
      ) : available.length === 0 ? (
        <p className="text-xs text-ink-muted">Sem cursos disponíveis pra adicionar.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className="pco-btn-ghost text-xs"
              title={c.title}
            >
              + {c.shortTitle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
