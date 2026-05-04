import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  PlayCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { startCsvDryRun, downloadImportTemplate } from '../../../data/api';
import { useToast } from '../../../components/Toast';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';
import type { ImportEntityTypeDto } from '../../../data/api';

const ENTITIES: Array<{ id: ImportEntityTypeDto; label: string; hint: string }> = [
  { id: 'student', label: 'Alunos', hint: 'Importa users → students' },
  { id: 'course', label: 'Cursos', hint: 'Cria/atualiza Course' },
  { id: 'module', label: 'Módulos', hint: 'Vincula a course pai' },
  { id: 'lesson', label: 'Aulas', hint: 'Vincula a curso/módulo' },
  { id: 'product', label: 'Produtos WC', hint: 'Catálogo de venda' },
  { id: 'order', label: 'Pedidos WC', hint: 'Compras realizadas' },
  { id: 'enrollment', label: 'Matrículas', hint: 'Aluno × curso × duração' },
  { id: 'progress', label: 'Progresso', hint: 'Aulas concluídas' },
];

export default function ImportWizardCsv() {
  useDocumentMeta({ title: 'Importação CSV — Admin' });
  const [files, setFiles] = useState<Partial<Record<ImportEntityTypeDto, File>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  function setFile(entity: ImportEntityTypeDto, file: File | null) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[entity] = file;
      else delete next[entity];
      return next;
    });
  }

  async function handleSubmit() {
    if (Object.keys(files).length === 0) {
      setError('Selecione ao menos um arquivo CSV.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await startCsvDryRun(files);
      toast.success(`Dry-run iniciado (${res.totalRows} linhas)`);
      navigate(`/admin/imports/jobs/${res.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/imports"
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold text-pco-deep mt-1">Importação por CSV</h1>
          <p className="text-sm text-ink-muted">
            Faça upload dos arquivos preenchidos. Use os modelos abaixo para garantir os
            cabeçalhos corretos. Após upload, rodamos um <strong>dry-run</strong> que valida
            tudo antes de gravar.
          </p>
        </div>
      </header>

      <div className="grid gap-3">
        {ENTITIES.map((e) => (
          <EntityFileRow
            key={e.id}
            entity={e.id}
            label={e.label}
            hint={e.hint}
            file={files[e.id]}
            onChange={(f) => setFile(e.id, f)}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
          <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3 items-start text-xs text-ink-muted">
        <CheckCircle2 size={16} className="text-pco-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-pco-deep font-semibold mb-0.5">Dry-run não grava nada</p>
          <p>
            O sistema vai ler, validar campos, normalizar e mostrar quantos registros são
            válidos/inválidos por entidade. Você revisa antes de confirmar a execução real.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || Object.keys(files).length === 0}
          className="pco-btn-primary"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} strokeWidth={2} />
          )}
          {submitting ? 'Enviando...' : 'Iniciar dry-run'}
        </button>
      </div>
    </div>
  );
}

function EntityFileRow({
  entity,
  label,
  hint,
  file,
  onChange,
}: {
  entity: ImportEntityTypeDto;
  label: string;
  hint: string;
  file: File | undefined;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  return (
    <div className="pco-card p-3 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <FileText size={14} className="text-pco-blue shrink-0" strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-pco-deep">{label}</div>
          <div className="text-[11px] text-ink-subtle">{hint}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await downloadImportTemplate(entity);
            toast.info(`Modelo ${label} baixado`);
          } catch (err) {
            toast.error('Falha', err instanceof Error ? err.message : 'Erro');
          }
        }}
        className="pco-btn-ghost text-xs"
        title="Baixar modelo"
      >
        <Download size={11} strokeWidth={2} />
        Modelo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={file ? 'pco-btn-secondary text-xs' : 'pco-btn-ghost text-xs'}
      >
        <Upload size={11} strokeWidth={2} />
        {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Selecionar CSV'}
      </button>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="pco-btn-ghost text-xs text-status-danger"
        >
          ✕
        </button>
      )}
    </div>
  );
}
