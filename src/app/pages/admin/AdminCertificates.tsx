import { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Search,
  Eye,
  CheckCircle2,
  Trash2,
  Copy,
  AlertCircle,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import {
  useAllCertificates,
  useIssueCertificate,
  useRevokeCertificate,
  useCourses,
  useAdminStudents,
} from '../../data/hooks';
import * as api from '../../data/api';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import type { Certificate } from '../../types/schema';

const tabs = [
  { id: 'emitidos', label: 'Emitidos', icon: <CheckCircle2 size={14} strokeWidth={1.75} /> },
  { id: 'emitir', label: 'Emitir', icon: <Plus size={14} strokeWidth={1.75} /> },
  { id: 'validar', label: 'Validar', icon: <Eye size={14} strokeWidth={1.75} /> },
];

export default function AdminCertificates() {
  const [active, setActive] = useState('emitidos');
  const [search, setSearch] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState<Certificate | null>(null);

  const certs = useAllCertificates();
  const courses = useCourses();
  const students = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const issue = useIssueCertificate();
  const revoke = useRevokeCertificate();
  const toast = useToast();

  const courseById = useMemo(() => {
    const map = new Map<string, string>();
    (courses.data ?? []).forEach((c) => map.set(c.id, c.shortTitle));
    return map;
  }, [courses.data]);

  const studentById = useMemo(() => {
    const map = new Map<string, string>();
    (students.data ?? []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [students.data]);

  const filtered = useMemo(() => {
    const list = certs.data ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      return (
        (c.validationCode ?? '').toLowerCase().includes(q) ||
        (studentById.get(c.studentId) ?? '').toLowerCase().includes(q) ||
        (courseById.get(c.courseId) ?? '').toLowerCase().includes(q)
      );
    });
  }, [certs.data, search, studentById, courseById]);

  const issued = (certs.data ?? []).filter((c) => c.status === 'issued');
  const inProgress = (certs.data ?? []).filter((c) => c.status !== 'issued');

  async function handleRevoke() {
    if (!confirmRevoke) return;
    try {
      await revoke.mutateAsync(confirmRevoke.id);
      toast.success('Certificado revogado');
      setConfirmRevoke(null);
    } catch (err) {
      toast.error('Falha ao revogar', err instanceof Error ? err.message : 'Erro');
    }
  }

  function copyValidationLink(code: string) {
    const url = `${window.location.origin}/api/certificates/validate/${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link de validação copiado'),
      () => toast.error('Não foi possível copiar'),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Certificados</h1>
          <p className="pco-section-subtitle mt-1">
            Lista, emissão manual e validação por código.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Emitidos" value={issued.length} accent="green" />
        <Stat label="Em andamento" value={inProgress.length} />
        <Stat label="Total" value={(certs.data ?? []).length} />
      </div>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'emitidos' && (
        <div className="space-y-4">
          <div className="pco-card p-3 flex items-center gap-3">
            <Search className="text-ink-subtle ml-2" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pco-input border-0 shadow-none"
              placeholder="Buscar aluno, curso ou código..."
            />
          </div>
          {certs.isLoading ? (
            <CardListSkeleton count={4} />
          ) : certs.isError ? (
            <ErrorState
              action={
                <button onClick={() => certs.refetch()} className="pco-btn-secondary text-xs">
                  Tentar novamente
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhum certificado"
              description="Quando alguém concluir um curso, o certificado aparecerá aqui."
            />
          ) : (
            <div className="pco-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-off">
                    <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                      <th className="px-4 py-3 text-left font-medium">Aluno</th>
                      <th className="px-4 py-3 text-left font-medium">Curso</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Emissão</th>
                      <th className="px-4 py-3 text-left font-medium">Código</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-surface-gray hover:bg-surface-off"
                      >
                        <td className="px-4 py-3 font-semibold text-pco-deep">
                          {studentById.get(c.studentId) ?? c.studentId}
                        </td>
                        <td className="px-4 py-3">
                          <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                            {courseById.get(c.courseId) ?? c.courseId}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.status === 'issued' ? (
                            <span className="pco-badge bg-status-success/10 text-status-success">
                              Emitido
                            </span>
                          ) : c.status === 'available' ? (
                            <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                              Disponível
                            </span>
                          ) : (
                            <span className="pco-badge bg-surface-gray text-ink-muted">
                              Em curso ({c.progress ?? 0}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs">
                          {c.issuedAt
                            ? new Date(c.issuedAt).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] text-pco-deep">
                            {c.validationCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => copyValidationLink(c.validationCode)}
                              className="pco-btn-ghost text-xs px-2.5"
                              title="Copiar link de validação"
                            >
                              <Copy size={12} strokeWidth={1.75} />
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(c)}
                              className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                              title="Revogar"
                            >
                              <Trash2 size={12} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {active === 'emitir' && (
        <IssueForm
          students={students.data ?? []}
          courses={(courses.data ?? []).map((c) => ({ id: c.id, label: c.shortTitle }))}
          submitting={issue.isPending}
          onSubmit={async (studentId, courseId) => {
            try {
              await issue.mutateAsync({ studentId, courseId });
              toast.success('Certificado emitido');
              setActive('emitidos');
            } catch (err) {
              toast.error('Falha ao emitir', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      {active === 'validar' && <ValidateForm />}

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revogar certificado?"
        description={
          confirmRevoke && (
            <>
              Código <strong>{confirmRevoke.validationCode}</strong>. Esta ação é irreversível e
              invalida o link público de verificação.
            </>
          )
        }
        confirmLabel="Revogar"
        variant="danger"
        loading={revoke.isPending}
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={handleRevoke}
      />
    </div>
  );
}

interface IssueFormProps {
  students: Array<{ id: string; name: string; email: string }>;
  courses: Array<{ id: string; label: string }>;
  submitting: boolean;
  onSubmit: (studentId: string, courseId: string) => Promise<void>;
}

function IssueForm({ students, courses, submitting, onSubmit }: IssueFormProps) {
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!studentId || !courseId) {
          setError('Selecione aluno e curso.');
          return;
        }
        void onSubmit(studentId, courseId);
      }}
      className="pco-card p-6 space-y-4 max-w-xl"
    >
      <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
        <Award size={16} className="text-status-gold" strokeWidth={1.75} />
        Emitir certificado manualmente
      </h3>
      <div>
        <label className="text-xs uppercase tracking-wide text-ink-muted">Aluno</label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="pco-input mt-1 text-sm"
        >
          <option value="">— selecione —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.email})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-ink-muted">Curso</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="pco-input mt-1 text-sm"
        >
          <option value="">— selecione —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
          <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button type="submit" className="pco-btn-primary text-sm" disabled={submitting}>
        <Plus size={14} strokeWidth={2} />
        {submitting ? 'Emitindo...' : 'Emitir certificado'}
      </button>
    </form>
  );
}

function ValidateForm() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<null | { valid: boolean; cert?: Certificate }>(null);
  const [loading, setLoading] = useState(false);

  async function onValidate() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const r = await api.validateCertificate(code.trim().toUpperCase());
      setResult({ valid: r.valid, cert: r.certificate });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 max-w-3xl">
      <div className="pco-card p-6 space-y-4">
        <h3 className="text-base font-semibold text-pco-deep">Validar certificado</h3>
        <p className="text-xs text-ink-muted">
          Insira o código de validação impresso no certificado.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PCO-XXX-XXX-XXX"
          className="pco-input font-mono"
        />
        <button
          onClick={onValidate}
          disabled={loading}
          className="pco-btn-primary w-full justify-center text-xs"
        >
          {loading ? 'Validando...' : 'Validar'}
        </button>
      </div>
      <div className="pco-card p-6">
        <h3 className="text-base font-semibold text-pco-deep mb-3">Resultado</h3>
        {result === null && (
          <p className="text-sm text-ink-muted text-center py-8">
            Insira um código para validar.
          </p>
        )}
        {result?.valid && result.cert && (
          <div className="rounded-xl border border-status-success/30 bg-status-success/5 p-4">
            <div className="flex items-center gap-2 text-status-success font-semibold mb-2">
              <CheckCircle2 size={16} strokeWidth={2} />
              Certificado válido
            </div>
            <div className="space-y-1 text-sm">
              <Row label="Código" value={result.cert.validationCode} mono />
              <Row label="Aluno (id)" value={result.cert.studentId} />
              <Row label="Curso (id)" value={result.cert.courseId} />
              <Row
                label="Emissão"
                value={
                  result.cert.issuedAt
                    ? new Date(result.cert.issuedAt).toLocaleDateString('pt-BR')
                    : '—'
                }
              />
            </div>
          </div>
        )}
        {result && !result.valid && (
          <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
            <div className="text-status-danger font-semibold mb-1">Código não encontrado</div>
            <p className="text-xs text-ink-muted">
              Verifique o código e tente novamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green';
}) {
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent === 'green' ? 'text-status-success' : 'text-pco-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted text-xs">{label}</span>
      <span className={`font-semibold text-pco-deep ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
