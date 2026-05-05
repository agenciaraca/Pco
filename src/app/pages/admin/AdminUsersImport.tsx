import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  UserPlus,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useImportUsers, useCourses } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { ImportUserRowDto, ImportUsersResultDto } from '../../data/api';

export default function AdminUsersImport() {
  useDocumentMeta({ title: 'Importar alunos — Admin AVA PCO' });
  const courses = useCourses();
  const importMut = useImportUsers();
  const toast = useToast();

  const [csvText, setCsvText] = useState('');
  const [defaultCourseId, setDefaultCourseId] = useState<string>('');
  const [result, setResult] = useState<ImportUsersResultDto | null>(null);

  const parsed = useMemo(() => parseCsv(csvText), [csvText]);

  function downloadTemplate() {
    const csv = 'email,name,course_id\naluno@exemplo.com,João Silva,c-id-aqui\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-import-alunos.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    setResult(null);
  }

  async function handleImport() {
    if (parsed.rows.length === 0) {
      toast.error('Vazio', 'Cole CSV ou faça upload primeiro.');
      return;
    }
    const rows: ImportUserRowDto[] = parsed.rows.map((r) => ({
      email: r.email,
      name: r.name,
      courseIds: r.courseId
        ? [r.courseId]
        : defaultCourseId
          ? [defaultCourseId]
          : [],
    }));
    try {
      const r = await importMut.mutateAsync(rows);
      setResult(r);
      toast.success(
        'Importação concluída',
        `${r.created} criados, ${r.enrolled} matrículas, ${r.errors.length} erros`,
      );
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          to="/admin/usuarios"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep mt-1 flex items-center gap-2">
          <UserPlus size={20} className="text-pco-blue" strokeWidth={1.75} />
          Importar alunos via CSV
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Upload simples para criar alunos em massa e (opcionalmente) matricular
          em um curso. Para imports complexos vindos de WordPress/LearnDash, use
          o wizard em <code>/admin/imports</code>.
        </p>
      </div>

      <section className="pco-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pco-deep">1. Modelo CSV</h2>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-ink-muted">
            Colunas: <code>email</code>, <code>name</code>, <code>course_id</code>{' '}
            (opcional). Email é o único campo obrigatório.
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="pco-btn-ghost text-xs"
          >
            <Download size={11} strokeWidth={2} />
            Baixar modelo
          </button>
        </div>
      </section>

      <section className="pco-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pco-deep">2. Carregar dados</h2>
        <div>
          <label className="pco-btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
            <Upload size={11} strokeWidth={2} />
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
              className="hidden"
            />
          </label>
          <span className="text-[11px] text-ink-subtle ml-2">
            ou cole o conteúdo abaixo:
          </span>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          placeholder="email,name,course_id&#10;aluno@exemplo.com,João Silva,&#10;outro@exemplo.com,Maria,c-abc"
          className="pco-input text-xs font-mono w-full"
        />
        {parsed.rows.length > 0 && (
          <div className="text-[11px] text-status-success">
            <CheckCircle2 size={11} className="inline" /> {parsed.rows.length}{' '}
            linha(s) detectada(s)
            {parsed.errors.length > 0 && (
              <span className="text-pco-orange ml-2">
                ({parsed.errors.length} com problemas)
              </span>
            )}
          </div>
        )}
      </section>

      <section className="pco-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-pco-deep">
          3. Curso padrão (opcional)
        </h2>
        <p className="text-[11px] text-ink-muted">
          Se a coluna course_id estiver vazia, este curso é usado como fallback.
          Deixe vazio se quiser apenas criar contas sem matricular.
        </p>
        <select
          value={defaultCourseId}
          onChange={(e) => setDefaultCourseId(e.target.value)}
          className="pco-input text-sm"
        >
          <option value="">— Nenhum (só criar conta) —</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </section>

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={handleImport}
          disabled={importMut.isPending || parsed.rows.length === 0}
          className="pco-btn-primary"
        >
          {importMut.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FileText size={12} strokeWidth={2} />
          )}
          Importar {parsed.rows.length} aluno(s)
        </button>
      </div>

      {result && (
        <section className="pco-card p-4 space-y-3 border-pco-blue/30">
          <h2 className="text-sm font-semibold text-pco-deep">Resultado</h2>
          <div className="grid gap-2 sm:grid-cols-4 text-xs">
            <Stat label="Total" value={result.total} />
            <Stat label="Criados" value={result.created} color="text-pco-blue" />
            <Stat
              label="Matrículas"
              value={result.enrolled}
              color="text-status-success"
            />
            <Stat
              label="Erros"
              value={result.errors.length}
              color="text-status-danger"
            />
          </div>
          {result.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-status-danger flex items-center gap-1">
                <AlertCircle size={11} />
                Ver erros ({result.errors.length})
              </summary>
              <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li
                    key={i}
                    className="font-mono text-[10px] text-ink-muted bg-surface-mute p-2 rounded"
                  >
                    L{err.row}: {err.email ?? '?'} — {err.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = 'text-pco-deep',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="pco-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

interface ParsedRow {
  email: string;
  name?: string;
  courseId?: string;
}

function parseCsv(text: string): {
  rows: ParsedRow[];
  errors: Array<{ line: number; message: string }>;
} {
  const rows: ParsedRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors };

  // Detecta cabeçalho
  const firstLine = lines[0]!.toLowerCase();
  const hasHeader = firstLine.includes('email');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Mapeia colunas se há header
  let cols = ['email', 'name', 'course_id'];
  if (hasHeader) {
    cols = lines[0]!
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/^"|"$/g, ''));
  }

  for (let i = 0; i < dataLines.length; i++) {
    const cells = dataLines[i]!.split(',').map((s) =>
      s.trim().replace(/^"|"$/g, ''),
    );
    const get = (name: string): string => {
      const idx = cols.indexOf(name);
      return idx >= 0 ? (cells[idx] ?? '') : '';
    };
    const email = get('email');
    if (!email) {
      errors.push({ line: i + (hasHeader ? 2 : 1), message: 'email vazio' });
      continue;
    }
    rows.push({
      email,
      name: get('name') || undefined,
      courseId: get('course_id') || undefined,
    });
  }
  return { rows, errors };
}
