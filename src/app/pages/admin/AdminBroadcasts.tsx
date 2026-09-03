import { useState, useMemo } from 'react';
import { Send, Megaphone, Eye, Loader2 } from 'lucide-react';
import {
  useBroadcasts,
  usePreviewBroadcast,
  useStartBroadcast,
  useCourses,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { BroadcastAudienceDto } from '../../data/api';
import { useT } from '../../i18n';
import SortableTh from '../../components/SortableTh';
import { useTableSort } from '../../hooks/useTableSort';

const AUDIENCE_LABELS: Record<BroadcastAudienceDto, string> = {
  all: 'Todos os usuários ativos',
  students_active: 'Apenas alunos ativos',
  students_inactive: 'Alunos inativos (X dias)',
  admins: 'Apenas admins/superadmins',
  enrolled_in_course: 'Alunos matriculados num curso',
  no_enrollment: 'Alunos sem matrícula',
};

export default function AdminBroadcasts() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.broadcasts')} — Admin` });
  const broadcasts = useBroadcasts();
  const preview = usePreviewBroadcast();
  const start = useStartBroadcast();
  const coursesQ = useCourses();
  const toast = useToast();

  const { rows: sortedBroadcasts, field: sortField, direction: sortDirection, toggleSort } = useTableSort(
    broadcasts.data ?? [],
    (row, field) => {
      switch (field) {
        case 'createdAt': return row.createdAt;
        case 'subject': return row.subject;
        case 'audience': return row.audience;
        case 'status': return row.status;
        case 'sent': return row.sent;
        default: return null;
      }
    },
    'createdAt',
    'desc',
  );

  const [audience, setAudience] = useState<BroadcastAudienceDto>('students_active');
  const [courseId, setCourseId] = useState('');
  const [inactivityDays, setInactivityDays] = useState(30);
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');

  const previewCount = useMemo(() => preview.data?.count ?? null, [preview.data]);

  async function handlePreview() {
    try {
      await preview.mutateAsync({
        audience,
        courseId: audience === 'enrolled_in_course' ? courseId : undefined,
        inactivityDays:
          audience === 'students_inactive' ? inactivityDays : undefined,
      });
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleSend() {
    if (!subject.trim() || !html.trim()) {
      toast.error('Campos obrigatórios', 'Preencha assunto e corpo HTML');
      return;
    }
    if (!confirm(
      `Enviar para ${previewCount ?? '?'} destinatário(s)?\n\nUma vez disparado, os e-mails são enviados em background. Não dá para parar no meio.`,
    )) {
      return;
    }
    try {
      const r = await start.mutateAsync({
        subject: subject.trim(),
        html,
        audience,
        courseId: audience === 'enrolled_in_course' ? courseId : undefined,
        inactivityDays:
          audience === 'students_inactive' ? inactivityDays : undefined,
      });
      toast.success(`Campanha #${r.id} iniciada`, `${r.total} destinatários`);
      setSubject('');
      setHtml('');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Megaphone size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.broadcasts')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Envia e-mail em massa para audiência segmentada usando o módulo de e-mail
          transacional configurado.
        </p>
      </header>

      <section className="pco-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pco-deep">Nova campanha</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Audiência
            </span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as BroadcastAudienceDto)}
              className="pco-input mt-1 text-sm"
            >
              {(Object.keys(AUDIENCE_LABELS) as BroadcastAudienceDto[]).map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </option>
              ))}
            </select>
          </label>

          {audience === 'enrolled_in_course' && (
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                Curso
              </span>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="pco-input mt-1 text-sm"
              >
                <option value="">— selecione —</option>
                {(coursesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {audience === 'students_inactive' && (
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                Inativos há (dias)
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={inactivityDays}
                onChange={(e) => setInactivityDays(Number(e.target.value))}
                className="pco-input mt-1 text-sm"
              />
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={preview.isPending}
            className="pco-btn-ghost text-xs"
          >
            <Eye size={11} strokeWidth={2} />
            {preview.isPending ? 'Calculando...' : 'Preview audiência'}
          </button>
          {previewCount !== null && (
            <span className="text-sm text-pco-deep">
              <strong>{previewCount}</strong> destinatário(s)
              {preview.data?.sample && preview.data.sample.length > 0 && (
                <span className="text-ink-muted">
                  {' '}
                  · ex: {preview.data.sample.slice(0, 3).map((s) => s.email).join(', ')}
                </span>
              )}
            </span>
          )}
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            Assunto
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Novidades de Junho — AVA PCO"
            className="pco-input mt-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            HTML do corpo
          </span>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={12}
            placeholder="<p>Olá!</p><p>Temos novidades...</p>"
            className="pco-input mt-1 text-xs font-mono"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={start.isPending || !subject || !html}
            className="pco-btn-primary text-xs"
          >
            {start.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Send size={11} strokeWidth={2} />
            )}
            Disparar campanha
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2">Histórico</h2>
        {broadcasts.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (broadcasts.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhuma campanha ainda.
          </div>
        ) : (
          <div className="pco-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted">
                <tr>
                  <SortableTh field="createdAt" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">Data</SortableTh>
                  <SortableTh field="subject" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">Assunto</SortableTh>
                  <SortableTh field="audience" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">Audiência</SortableTh>
                  <SortableTh field="status" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">Status</SortableTh>
                  <SortableTh field="sent" current={sortField} direction={sortDirection} onSort={toggleSort} className="text-xs">Enviados / Total</SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {sortedBroadcasts.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 font-semibold text-pco-deep">
                      {b.subject}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{b.audience}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`pco-badge ${
                          b.status === 'completed'
                            ? 'bg-status-success/10 text-status-success'
                            : b.status === 'running'
                              ? 'bg-pco-blue/10 text-pco-blue'
                              : b.status === 'failed'
                                ? 'bg-status-danger/15 text-status-danger'
                                : 'bg-surface-gray text-ink-muted'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {b.sent}/{b.total} {b.failed > 0 && (
                        <span className="text-status-danger">({b.failed} falhos)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
