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
import {
  startCsvDryRun,
  startCsvRunReal,
  downloadImportTemplate,
} from '../../../data/api';
import { useToast } from '../../../components/Toast';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';
import type {
  ImportEntityTypeDto,
  EnrollmentStartRuleDto,
  EnrollmentExpirationRuleDto,
} from '../../../data/api';

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
  const [startRule, setStartRule] = useState<EnrollmentStartRuleDto>('paid_date');
  const [expirationRule, setExpirationRule] =
    useState<EnrollmentExpirationRuleDto>('start_plus_duration');
  const [defaultDuration, setDefaultDuration] = useState<number>(365);
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

  async function handleSubmit(real: boolean) {
    if (Object.keys(files).length === 0) {
      setError('Selecione ao menos um arquivo CSV.');
      return;
    }
    if (
      real &&
      !confirm(
        `Executar importação REAL?\n\nIsto irá criar/atualizar registros no AVA.\n\n${Object.keys(files).length} arquivo(s) selecionado(s).`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = real
        ? await startCsvRunReal(files, {
            startRule,
            expirationRule,
            defaultAccessDurationDays: defaultDuration,
          })
        : await startCsvDryRun(files);
      toast.success(
        `${real ? 'Execução real' : 'Dry-run'} iniciada (${res.totalRows} linhas)`,
      );
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

      <section className="pco-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-pco-deep">Regras de matrícula</h3>
        <p className="text-xs text-ink-muted">
          Aplicadas apenas a CSVs de matrícula (e geradas a partir de pedidos quando vier
          esse caminho). Para dry-run não importa.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Data inicial
            </span>
            <select
              value={startRule}
              onChange={(e) => setStartRule(e.target.value as EnrollmentStartRuleDto)}
              className="pco-input mt-1 text-sm"
            >
              <option value="paid_date">Data de pagamento</option>
              <option value="completed_date">Data de conclusão do pedido</option>
              <option value="order_date">Data do pedido</option>
              <option value="imported">Importada (CSV)</option>
              <option value="now">Agora</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Data de expiração
            </span>
            <select
              value={expirationRule}
              onChange={(e) =>
                setExpirationRule(e.target.value as EnrollmentExpirationRuleDto)
              }
              className="pco-input mt-1 text-sm"
            >
              <option value="start_plus_duration">Início + duração</option>
              <option value="order_plus_duration">Pedido + duração</option>
              <option value="paid_plus_duration">Pagamento + duração</option>
              <option value="completed_plus_duration">Conclusão + duração</option>
              <option value="explicit">Importada (CSV)</option>
              <option value="lifetime">Vitalícia</option>
              <option value="course_fixed_end">Data fixa do curso</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Duração padrão (dias)
            </span>
            <input
              type="number"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
              min={0}
              className="pco-input mt-1 text-sm"
            />
          </label>
        </div>
      </section>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3 items-start text-xs text-ink-muted">
        <CheckCircle2 size={16} className="text-pco-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-pco-deep font-semibold mb-0.5">
            Dry-run primeiro, sempre
          </p>
          <p>
            O dry-run não grava nada. Use-o para validar antes da execução real. A execução
            real cria/atualiza registros usando os adapters seguros do AVA.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting || Object.keys(files).length === 0}
          className="pco-btn-secondary"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} strokeWidth={2} />
          )}
          Dry-run
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={submitting || Object.keys(files).length === 0}
          className="pco-btn-primary"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} strokeWidth={2} />
          )}
          Executar importação real
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
