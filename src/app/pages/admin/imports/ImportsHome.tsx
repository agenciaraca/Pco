import { Link } from 'react-router-dom';
import {
  Download,
  Database,
  FileText,
  Cloud,
  History as HistoryIcon,
  PlayCircle,
  Info,
} from 'lucide-react';
import { useImportTemplates, useImportJobs } from '../../../data/hooks';
import { downloadImportTemplate } from '../../../data/api';
import { useToast } from '../../../components/Toast';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';
import type { ImportEntityTypeDto } from '../../../data/api';

const entityLabel: Record<ImportEntityTypeDto, string> = {
  student: 'Alunos',
  course: 'Cursos',
  module: 'Módulos',
  lesson: 'Aulas',
  product: 'Produtos WooCommerce',
  order: 'Pedidos WooCommerce',
  enrollment: 'Matrículas',
  progress: 'Progresso',
};

export default function ImportsHome() {
  useDocumentMeta({ title: 'Importar dados — Admin AVA PCO' });
  const templates = useImportTemplates();
  const jobs = useImportJobs();
  const toast = useToast();

  async function handleDownload(entity: ImportEntityTypeDto) {
    try {
      await downloadImportTemplate(entity);
      toast.success(`Modelo CSV ${entityLabel[entity]} baixado`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const recentJobs = (jobs.data ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep">Importar dados</h1>
        <p className="text-sm text-ink-muted mt-1">
          Migre alunos, cursos, módulos, aulas, produtos, pedidos e matrículas vindos de
          WordPress + LearnDash + WooCommerce. Importação aditiva — não altera nada do que já
          existe sem confirmação.
        </p>
      </header>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 flex gap-3 items-start text-sm text-ink-muted">
        <Info size={16} className="text-pco-blue shrink-0 mt-0.5" strokeWidth={1.75} />
        <div>
          <p className="text-pco-deep font-semibold mb-1">Como funciona</p>
          <ol className="list-decimal pl-5 space-y-0.5 text-xs">
            <li>Escolha a origem: API (WP/LD/WC) ou CSV.</li>
            <li>Configure conexão ou faça upload dos arquivos.</li>
            <li>Mapeie campos de origem para os campos do AVA.</li>
            <li>Resolva relacionamentos (aluno↔email, produto↔curso, etc.).</li>
            <li>Configure regras de matrícula e expiração.</li>
            <li>Pré-visualize e simule (dry-run) antes de gravar.</li>
            <li>Execute. Acompanhe progresso em tempo real.</li>
          </ol>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-pco-deep">Nova importação</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/admin/imports/wizard?source=csv"
            className="pco-card pco-card-hover p-4 flex items-start gap-3"
          >
            <div className="h-10 w-10 rounded-lg bg-pco-blue/10 grid place-items-center shrink-0">
              <FileText size={18} strokeWidth={1.75} className="text-pco-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-pco-deep">Importar via CSV</div>
              <p className="mt-0.5 text-xs text-ink-muted">
                Faça upload de arquivos CSV preenchidos. Bom para migrações pontuais ou quando
                a API não está disponível.
              </p>
            </div>
            <PlayCircle size={16} strokeWidth={1.75} className="text-pco-blue shrink-0" />
          </Link>
          <Link
            to="/admin/imports/wizard-api"
            className="pco-card pco-card-hover p-4 flex items-start gap-3"
          >
            <div className="h-10 w-10 rounded-lg bg-pco-cyan/15 grid place-items-center shrink-0">
              <Cloud size={18} strokeWidth={1.75} className="text-pco-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-pco-deep">Importar via API</div>
              <p className="mt-0.5 text-xs text-ink-muted">
                Conecta diretamente em WordPress + LearnDash + WooCommerce e puxa os dados.
                Recomendado para migrações grandes.
              </p>
            </div>
            <PlayCircle size={16} strokeWidth={1.75} className="text-pco-cyan shrink-0" />
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-pco-deep">Modelos CSV</h2>
          <span className="text-[11px] text-ink-subtle">
            Cabeçalho + linha de exemplo + linha em branco
          </span>
        </div>
        {templates.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(templates.data ?? []).map((t) => (
              <li
                key={t.entity}
                className="pco-card p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Database size={14} className="text-pco-blue shrink-0" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep">
                      {entityLabel[t.entity]}
                    </div>
                    <div className="text-[11px] text-ink-subtle">
                      {t.fields.length} campos · {t.fields.filter((f) => f.required).length}{' '}
                      obrigatórios
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(t.entity)}
                  className="pco-btn-ghost text-xs"
                  title={`Baixar ${t.filename}`}
                >
                  <Download size={12} strokeWidth={2} />
                  CSV
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <HistoryIcon size={16} className="text-pco-blue" strokeWidth={1.75} />
            Importações recentes
          </h2>
          <Link to="/admin/imports/history" className="text-xs text-pco-blue hover:underline">
            Ver todas →
          </Link>
        </div>
        {jobs.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : recentJobs.length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhuma importação ainda. Comece pelo botão acima.
          </div>
        ) : (
          <ul className="space-y-2">
            {recentJobs.map((j) => (
              <li key={j.id} className="pco-card p-3">
                <Link
                  to={`/admin/imports/jobs/${j.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-pco-deep">
                        {j.source} · {j.mode}
                      </span>
                      <StatusBadge status={j.status} />
                      {j.dryRun && (
                        <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                          dry-run
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-subtle">
                      por {j.startedBy} ·{' '}
                      {new Date(j.startedAt).toLocaleString('pt-BR')} ·{' '}
                      {j.stats.totalRead} lidos · {j.stats.created} criados ·{' '}
                      {j.stats.errors} erros
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-surface-gray text-ink-muted',
    running: 'bg-pco-blue/10 text-pco-blue',
    completed: 'bg-status-success/10 text-status-success',
    completed_with_errors: 'bg-pco-orange/10 text-pco-orange',
    failed: 'bg-status-danger/15 text-status-danger',
    canceled: 'bg-surface-gray text-ink-muted',
    rolled_back: 'bg-pco-cyan/15 text-pco-cyan',
  };
  return (
    <span className={`pco-badge ${map[status] ?? 'bg-surface-gray text-ink-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
