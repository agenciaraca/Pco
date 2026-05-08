import { Languages, BookOpen, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranscriptCoverage } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';

export default function AdminTranscripts() {
  const t = useT();
  useDocumentMeta({ title: 'Transcrições — Admin AVA PCO' });
  const { data, isLoading, isError, refetch } = useTranscriptCoverage();

  if (isLoading) return <CardListSkeleton count={5} />;
  if (isError || !data) {
    return <ErrorState action={<button onClick={() => refetch()} className="pco-btn-primary text-xs">{t('common.retry')}</button>} />;
  }

  const { totals, courses } = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Languages size={20} className="text-pco-blue" strokeWidth={1.75} />
          Cobertura de transcrições
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Visão geral por curso de quais aulas têm transcrição em quais idiomas.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Total de aulas"
          value={totals.totalLessons}
          tone="default"
        />
        <Stat
          label="Com transcrição"
          value={`${totals.withAnyTranscript} (${totals.coveragePct}%)`}
          tone="primary"
        />
        <Stat label="Aulas em PT" value={totals.perLang.pt} flag="🇧🇷" />
        <Stat label="Aulas em ES + EN" value={totals.perLang.es + totals.perLang.en} flag="🌐" />
      </div>

      {courses.length === 0 ? (
        <EmptyState title={t('common.empty')} description="Nenhum curso publicado ainda." />
      ) : (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-4 py-3 text-left font-medium">Curso</th>
                  <th className="px-4 py-3 text-right font-medium">Aulas</th>
                  <th className="px-4 py-3 text-right font-medium">PT</th>
                  <th className="px-4 py-3 text-right font-medium">ES</th>
                  <th className="px-4 py-3 text-right font-medium">EN</th>
                  <th className="px-4 py-3 text-right font-medium">Cobertura</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr
                    key={c.courseId}
                    className="border-t border-surface-gray hover:bg-surface-off"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-pco-deep">
                        {c.shortTitle}
                      </div>
                      <div className="text-[11px] text-ink-subtle truncate max-w-xs">
                        {c.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted">
                      {c.totalLessons}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LangCell n={c.perLang.pt} total={c.totalLessons} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LangCell n={c.perLang.es} total={c.totalLessons} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LangCell n={c.perLang.en} total={c.totalLessons} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CoverageBar pct={c.coveragePct} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/cursos/${c.courseId}`}
                        className="pco-btn-ghost text-xs"
                        title="Editar curso"
                      >
                        <BookOpen size={11} strokeWidth={2} />
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totals.withAnyTranscript === 0 && totals.totalLessons > 0 && (
        <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex items-start gap-3">
          <AlertCircle className="text-pco-orange shrink-0 mt-0.5" size={18} strokeWidth={1.75} />
          <div className="text-sm text-ink-muted">
            <strong className="text-pco-deep">Nenhuma transcrição configurada.</strong>{' '}
            Edite uma aula em qualquer curso e expanda "Transcrições da
            videoaula" pra adicionar texto em PT/ES/EN.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
  flag,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'primary';
  flag?: string;
}) {
  return (
    <div className="pco-card">
      <div className="text-[11px] uppercase tracking-wider text-ink-subtle">
        {flag && <span className="mr-1">{flag}</span>}
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          tone === 'primary' ? 'text-pco-blue' : 'text-pco-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LangCell({ n, total }: { n: number; total: number }) {
  if (total === 0) return <span className="text-ink-subtle">—</span>;
  const pct = Math.round((n / total) * 100);
  return (
    <div className="inline-flex items-baseline gap-1">
      <span className={n > 0 ? 'font-semibold text-pco-deep' : 'text-ink-subtle'}>
        {n}
      </span>
      {n > 0 && (
        <span className="text-[10px] text-ink-subtle">/{pct}%</span>
      )}
    </div>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-surface-gray overflow-hidden">
        <div
          className={`h-full ${
            pct >= 80
              ? 'bg-status-success'
              : pct >= 30
                ? 'bg-pco-blue'
                : 'bg-pco-orange'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-pco-deep w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}
