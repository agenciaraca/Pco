import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  Save,
  Eye,
  Loader2,
  Send,
} from 'lucide-react';
import {
  useWeeklyReportConfig,
  useSaveWeeklyReportConfig,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import * as api from '../../data/api';

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export default function AdminWeeklyReport() {
  useDocumentMeta({ title: 'Relatório semanal — Admin' });
  const cfgQ = useWeeklyReportConfig();
  const saveMut = useSaveWeeklyReportConfig();
  const toast = useToast();

  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(9);
  const [roles, setRoles] = useState<('admin' | 'superadmin')[]>([
    'admin',
    'superadmin',
  ]);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (cfgQ.data) {
      setEnabled(cfgQ.data.enabled);
      setDay(cfgQ.data.dayOfWeekUtc);
      setHour(cfgQ.data.hourUtc);
      setRoles(cfgQ.data.recipientRoles);
    }
  }, [cfgQ.data]);

  function toggleRole(r: 'admin' | 'superadmin') {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function save() {
    try {
      await saveMut.mutateAsync({
        enabled,
        dayOfWeekUtc: day,
        hourUtc: hour,
        recipientRoles: roles,
      });
      toast.success('Configuração salva');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const r = await api.fetchWeeklyReportPreview();
      setPreviewSubject(r.email.subject);
      setPreviewHtml(r.email.html);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoadingPreview(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/admin/email"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar para configurações de e-mail
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2 mt-2">
          <CalendarRange size={20} className="text-pco-blue" strokeWidth={1.75} />
          Relatório semanal automático
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Snapshot consolidado dispara em e-mail uma vez por semana pra
          admins. Receita, novos alunos, certificados, reviews, suporte.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="pco-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-pco-deep">Configuração</h3>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-pco-blue h-4 w-4"
            />
            <span className="text-sm">
              <strong className="text-pco-deep">Ativo</strong>{' '}
              <span className="text-ink-muted">
                — dispara no slot configurado
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                Dia da semana (UTC)
              </span>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="pco-input text-sm mt-1"
              >
                {WEEKDAYS.map((w, idx) => (
                  <option key={idx} value={idx}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                Hora (UTC)
              </span>
              <input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="pco-input text-sm mt-1"
              />
              <p className="text-[10px] text-ink-subtle mt-1">
                BRT = UTC-3 (ex: 9 UTC = 6h da manhã BRT)
              </p>
            </label>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Destinatários
            </span>
            <div className="mt-2 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roles.includes('admin')}
                  onChange={() => toggleRole('admin')}
                  className="accent-pco-blue"
                />
                <span className="text-sm">Admins</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roles.includes('superadmin')}
                  onChange={() => toggleRole('superadmin')}
                  className="accent-pco-blue"
                />
                <span className="text-sm">Superadmins</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-pco-border">
            <button
              type="button"
              onClick={save}
              disabled={saveMut.isPending}
              className="pco-btn-primary text-xs"
            >
              <Save size={11} strokeWidth={2} />
              {saveMut.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={loadPreview}
              disabled={loadingPreview}
              className="pco-btn-ghost text-xs"
            >
              {loadingPreview ? (
                <Loader2 size={11} className="animate-spin" strokeWidth={2} />
              ) : (
                <Eye size={11} strokeWidth={2} />
              )}
              Gerar preview agora
            </button>
          </div>

          <p className="text-[11px] text-ink-subtle">
            Preview usa dados atuais (últimos 7 dias) sem enviar e-mail.
            Disparo real só acontece no slot configurado, quando ativo.
          </p>
        </section>

        <section className="pco-card p-0 overflow-hidden">
          <header className="flex items-center gap-2 p-3 bg-surface-off border-b border-pco-border">
            <Send size={14} className="text-pco-blue" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-pco-deep">
              Preview do e-mail
            </h3>
          </header>
          {previewSubject ? (
            <>
              <div className="p-3 bg-surface-mute/30 border-b border-pco-border">
                <div className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Subject
                </div>
                <div className="text-sm font-medium text-pco-deep mt-0.5">
                  {previewSubject}
                </div>
              </div>
              <iframe
                title="Preview do relatório semanal"
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                className="w-full h-[600px] border-0"
              />
            </>
          ) : (
            <div className="p-12 text-center text-sm text-ink-muted">
              Clique em "Gerar preview agora" para ver como o e-mail será
              enviado.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
