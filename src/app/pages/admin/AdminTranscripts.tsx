import { Languages, BookOpen, AlertCircle, Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranscriptCoverage, useCourses } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import { useState, useRef } from 'react';
import { useToast } from '../../components/Toast';
import * as api from '../../data/api';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminTranscripts() {
  const t = useT();
  useDocumentMeta({ title: 'Transcrições — Admin AVA PCO' });
  const { data, isLoading, isError, refetch } = useTranscriptCoverage();
  const coursesQ = useCourses();
  const [uploadResult, setUploadResult] = useState<api.TranscriptBulkResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const qc = useQueryClient();

  async function handleCsvUpload(file: File) {
    setUploading(true);
    setUploadResult(null);
    try {
      const text = await file.text();
      const items = parseCsv(text);
      if (items.length === 0) {
        toast.error('CSV vazio', 'Sem itens válidos. Esperado: lesson_id,lang,text');
        return;
      }
      const result = await api.bulkUpdateTranscripts({ items });
      setUploadResult(result);
      qc.invalidateQueries({ queryKey: ['admin-transcript-coverage'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      if (result.failed === 0) {
        toast.success(`${result.ok} transcrições atualizadas`);
      } else {
        toast.info(`${result.ok} ok, ${result.failed} falhou`);
      }
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

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

      <div className="pco-card space-y-3">
        <h2 className="text-base font-semibold text-pco-deep flex items-center gap-2">
          <Upload size={16} className="text-pco-blue" strokeWidth={1.75} />
          Importar transcrições via CSV
        </h2>
        <p className="text-xs text-ink-muted">
          Header esperado: <code className="font-mono bg-surface-mute px-1 rounded">lesson_id,lang,text</code>.
          Idiomas válidos: pt, es, en. Texto pode conter quebras de linha (use aspas).
          Máx 500 linhas por upload, 100k chars por texto.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCsvUpload(f);
            }}
            disabled={uploading}
            className="text-xs"
          />
          {uploading && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Loader2 size={12} className="animate-spin" />
              Processando...
            </span>
          )}
          <button
            type="button"
            onClick={() => downloadTemplate(coursesQ.data ?? [])}
            disabled={!coursesQ.data}
            className="pco-btn-ghost text-xs ml-auto"
            title="Baixa CSV com lesson_id de todas as aulas para preencher"
          >
            Baixar template (com IDs)
          </button>
        </div>
        {uploadResult && (
          <div className="mt-2 space-y-2">
            <div className="text-xs">
              <span className="font-semibold text-pco-deep">
                {uploadResult.total}
              </span>{' '}
              linhas processadas:{' '}
              <span className="text-status-success font-semibold">
                {uploadResult.ok} ok
              </span>
              {uploadResult.failed > 0 && (
                <>
                  ,{' '}
                  <span className="text-status-danger font-semibold">
                    {uploadResult.failed} falharam
                  </span>
                </>
              )}
            </div>
            {uploadResult.failed > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-ink-muted">
                  Ver erros ({uploadResult.failed})
                </summary>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {uploadResult.results
                    .filter((r) => !r.ok)
                    .map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 font-mono text-xs"
                      >
                        <XCircle
                          size={10}
                          className="text-status-danger mt-0.5 shrink-0"
                          strokeWidth={2}
                        />
                        <span>
                          <span className="text-ink-muted">{r.lessonId}</span>{' '}
                          <span className="text-pco-blue">[{r.lang}]</span>:{' '}
                          <span className="text-status-danger">{r.error}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            )}
            {uploadResult.ok > 0 && (
              <div className="inline-flex items-center gap-1 text-xs text-status-success">
                <CheckCircle2 size={10} strokeWidth={2} />
                Coverage atualizada
              </div>
            )}
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <EmptyState title={t('common.empty')} description="Nenhum curso publicado ainda." />
      ) : (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-xs uppercase tracking-wider text-ink-subtle">
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
                  <CourseRow
                    key={c.courseId}
                    coverage={c}
                    coursesData={coursesQ.data ?? []}
                    onAction={() => {
                      qc.invalidateQueries({ queryKey: ['admin-transcript-coverage'] });
                      qc.invalidateQueries({ queryKey: ['courses'] });
                    }}
                  />
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

function CourseRow({
  coverage: c,
  coursesData,
  onAction,
}: {
  coverage: api.TranscriptCoverageDto['courses'][number];
  coursesData: ReturnType<typeof useCourses>['data'] extends infer D
    ? D extends undefined
      ? never[]
      : D
    : never[];
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullCourse = (coursesData ?? []).find((x) => x.id === c.courseId);
  const lessons = (fullCourse?.modules ?? []).flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title })),
  );
  return (
    <>
      <tr className="border-t border-surface-gray hover:bg-surface-off">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-2 text-left w-full"
            aria-expanded={expanded}
          >
            <span
              className={`mt-0.5 text-pco-blue transition-transform ${
                expanded ? 'rotate-90' : ''
              }`}
            >
              ▸
            </span>
            <span>
              <div className="font-semibold text-pco-deep">{c.shortTitle}</div>
              <div className="text-xs text-ink-subtle truncate max-w-xs">
                {c.title}
              </div>
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-right text-ink-muted">{c.totalLessons}</td>
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
          <div className="inline-flex items-center gap-1 flex-wrap justify-end">
            <BulkTranslateButton
              courseId={c.courseId}
              courseTitle={c.shortTitle}
              perLang={c.perLang}
              onComplete={onAction}
            />
            <Link
              to={`/admin/cursos/${c.courseId}`}
              className="pco-btn-ghost text-xs"
              title="Editar curso"
            >
              <BookOpen size={11} strokeWidth={2} />
              Editar
            </Link>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-surface-gray bg-surface-off/40">
          <td colSpan={7} className="px-4 py-3">
            {lessons.length === 0 ? (
              <div className="text-xs text-ink-subtle">
                Nenhuma aula encontrada neste curso.
              </div>
            ) : (
              <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
                {lessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 py-1 border-b border-surface-gray/60 last:border-b-0"
                  >
                    <span className="font-mono text-xs text-ink-subtle shrink-0">
                      {l.id}
                    </span>
                    <span className="text-ink-muted shrink-0">{l.moduleTitle} ›</span>
                    <span className="text-pco-deep truncate flex-1">{l.title}</span>
                    <Link
                      to={`/admin/cursos/${c.courseId}`}
                      className="pco-btn-ghost text-xs shrink-0"
                      title="Editar aula no curso"
                    >
                      Editar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
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
      <div className="text-xs uppercase tracking-wider text-ink-subtle">
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
        <span className="text-xs text-ink-subtle">/{pct}%</span>
      )}
    </div>
  );
}

/**
 * Gera CSV template com 1 linha por aula × 3 idiomas (pt/es/en) — text vazio.
 * Admin baixa, abre no Excel/Sheets, preenche text, sobe de volta.
 */
function downloadTemplate(
  courses: Array<{
    id: string;
    title: string;
    shortTitle?: string;
    modules: Array<{
      id: string;
      title: string;
      lessons: Array<{ id: string; title: string }>;
    }>;
  }>,
): void {
  const escapeCsv = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const rows: string[] = ['lesson_id,lang,text,_course,_module,_lesson_title'];
  for (const co of courses) {
    for (const m of co.modules ?? []) {
      for (const l of m.lessons) {
        for (const lang of ['pt', 'es', 'en']) {
          rows.push(
            [
              escapeCsv(l.id),
              lang,
              '""',
              escapeCsv(co.shortTitle ?? co.title),
              escapeCsv(m.title),
              escapeCsv(l.title),
            ].join(','),
          );
        }
      }
    }
  }
  const blob = new Blob([rows.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `template-transcricoes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parser CSV simples — suporta quoted fields com escape "".
 * Espera header: lesson_id, lang, text. Aceita lessonId / language / texto.
 */
function parseCsv(raw: string): Array<{ lessonId: string; lang: string; text: string }> {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idIdx = header.findIndex((h) =>
    ['lesson_id', 'lessonid', 'lesson', 'id'].includes(h),
  );
  const langIdx = header.findIndex((h) => ['lang', 'language', 'idioma'].includes(h));
  const textIdx = header.findIndex((h) =>
    ['text', 'texto', 'transcript', 'transcricao', 'transcrição', 'content'].includes(h),
  );
  if (idIdx < 0 || langIdx < 0 || textIdx < 0) return [];
  const out: Array<{ lessonId: string; lang: string; text: string }> = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;
    const lessonId = (r[idIdx] ?? '').trim();
    const lang = (r[langIdx] ?? '').trim().toLowerCase();
    const text = r[textIdx] ?? '';
    if (lessonId && lang) out.push({ lessonId, lang, text });
  }
  return out;
}

function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(buf);
        buf = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && raw[i + 1] === '\n') i++;
        cur.push(buf);
        if (cur.some((c) => c !== '')) rows.push(cur);
        cur = [];
        buf = '';
      } else {
        buf += ch;
      }
    }
  }
  if (buf || cur.length > 0) {
    cur.push(buf);
    if (cur.some((c) => c !== '')) rows.push(cur);
  }
  return rows;
}

function BulkTranslateButton({
  courseId,
  courseTitle,
  perLang,
  onComplete,
}: {
  courseId: string;
  courseTitle: string;
  perLang: { pt: number; es: number; en: number };
  onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<api.BulkTranslateResult | null>(null);
  const toast = useToast();

  // Detecta source lang com mais conteúdo (mais aulas preenchidas)
  const candidates: Array<{ lang: 'pt' | 'es' | 'en'; n: number }> = (
    ['pt', 'es', 'en'] as const
  ).map((l) => ({ lang: l, n: perLang[l] }));
  const bestSource = candidates.sort((a, b) => b.n - a.n)[0];

  if (bestSource.n === 0) return null;

  async function runTranslate(toLang: 'pt' | 'es' | 'en') {
    if (toLang === bestSource.lang) return;
    if (
      !confirm(
        `Traduzir todas as aulas de "${courseTitle}" de ${bestSource.lang.toUpperCase()} para ${toLang.toUpperCase()}?\n\nApenas aulas SEM transcrição em ${toLang.toUpperCase()} serão preenchidas (não sobrescreve).\n\nA operação pode demorar alguns minutos.`,
      )
    ) {
      return;
    }
    setRunning(toLang);
    setLastResult(null);
    try {
      const r = await api.bulkTranslateCourse({
        courseId,
        fromLang: bestSource.lang,
        toLang,
      });
      setLastResult(r);
      onComplete();
      if (r.failed === 0) {
        toast.success(
          `${r.translated} traduzidas, ${r.skipped} puladas (~$${r.totalCostUsd})`,
        );
      } else {
        toast.info(
          `${r.translated} ok, ${r.failed} falharam, ${r.skipped} puladas`,
        );
      }
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={running !== null}
        className="pco-btn-ghost text-xs"
        title={`Traduzir em massa de ${bestSource.lang.toUpperCase()} (${bestSource.n} aulas)`}
      >
        {running ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          '🤖'
        )}
        Traduzir
      </button>
      {open && !running && (
        <div className="absolute right-0 top-full mt-1 z-10 pco-card p-2 shadow-lift min-w-[180px]">
          <div className="text-xs text-ink-muted mb-1 px-1">
            Fonte: {bestSource.lang.toUpperCase()} ({bestSource.n} aulas)
          </div>
          {(['pt', 'es', 'en'] as const)
            .filter((l) => l !== bestSource.lang)
            .map((toLang) => (
              <button
                key={toLang}
                type="button"
                onClick={() => {
                  setOpen(false);
                  void runTranslate(toLang);
                }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface-off"
              >
                → {toLang.toUpperCase()}
              </button>
            ))}
        </div>
      )}
      {lastResult && lastResult.failed > 0 && (
        <details className="absolute right-0 top-full mt-1 z-10 pco-card p-2 shadow-lift max-w-xs">
          <summary className="cursor-pointer text-xs text-status-danger">
            {lastResult.failed} erro(s)
          </summary>
          <ul className="mt-1 space-y-0.5 text-xs max-h-32 overflow-y-auto">
            {lastResult.results
              .filter((r) => !r.ok && !r.skipped)
              .map((r, i) => (
                <li key={i} className="text-ink-muted">
                  <span className="text-pco-deep">{r.title}</span>:{' '}
                  <span className="text-status-danger">{r.error}</span>
                </li>
              ))}
          </ul>
        </details>
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
