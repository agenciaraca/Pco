import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  Plus,
  Upload,
  Search,
  Filter,
  Eye,
  Mail,
  Lock,
  Unlock,
  ArrowUpDown,
} from 'lucide-react';
import { adminStudents, courses, type AdminStudentRow } from '../../data/seed';

const statusStyles: Record<AdminStudentRow['status'], string> = {
  ativo: 'bg-status-success/10 text-status-success',
  em_risco: 'bg-pco-orange/10 text-pco-orange',
  bloqueado: 'bg-status-danger/15 text-status-danger',
  inativo: 'bg-surface-gray text-ink-muted',
};

const statusLabel: Record<AdminStudentRow['status'], string> = {
  ativo: 'Ativo',
  em_risco: 'Em risco',
  bloqueado: 'Bloqueado',
  inativo: 'Inativo',
};

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [courseFilter, setCourseFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'name' | 'risk' | 'lastAccess'>('name');

  const filtered = useMemo(() => {
    let list = [...adminStudents];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'todos') {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (courseFilter !== 'todos') {
      list = list.filter((s) => s.enrolledCourseIds.includes(courseFilter));
    }
    list.sort((a, b) => {
      if (sortBy === 'risk') return b.riskScore - a.riskScore;
      if (sortBy === 'lastAccess')
        return new Date(b.lastAccessAt).getTime() - new Date(a.lastAccessAt).getTime();
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [search, statusFilter, courseFilter, sortBy]);

  const totals = useMemo(() => {
    const t = { total: adminStudents.length, ativos: 0, em_risco: 0, bloqueados: 0 };
    adminStudents.forEach((s) => {
      if (s.status === 'ativo') t.ativos++;
      if (s.status === 'em_risco') t.em_risco++;
      if (s.status === 'bloqueado') t.bloqueados++;
    });
    return t;
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Alunos</h1>
          <p className="pco-section-subtitle mt-1">
            Listagem, filtros, importação e gestão acadêmica.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="pco-btn-secondary text-xs">
            <Upload size={12} strokeWidth={2} />
            Importar CSV
          </button>
          <button className="pco-btn-primary text-xs">
            <Plus size={12} strokeWidth={2} />
            Novo aluno
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total" value={totals.total} />
        <SummaryCard label="Ativos" value={totals.ativos} accent="green" />
        <SummaryCard label="Em risco" value={totals.em_risco} accent="orange" />
        <SummaryCard label="Bloqueados" value={totals.bloqueados} accent="danger" />
      </div>

      <div className="pco-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              size={14}
              strokeWidth={1.75}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pco-input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pco-input w-auto"
          >
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="em_risco">Em risco</option>
            <option value="bloqueado">Bloqueados</option>
            <option value="inativo">Inativos</option>
          </select>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="pco-input w-auto"
          >
            <option value="todos">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortTitle}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="pco-input w-auto"
          >
            <option value="name">Ordenar: Nome</option>
            <option value="risk">Ordenar: Risco</option>
            <option value="lastAccess">Ordenar: Último acesso</option>
          </select>
          <span className="text-xs text-ink-subtle ml-auto">
            <Filter size={12} className="inline mr-1" />
            {filtered.length} resultado(s)
          </span>
        </div>
      </div>

      <div className="pco-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-off">
              <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <th className="px-4 py-3 text-left font-medium">Aluno</th>
                <th className="px-4 py-3 text-left font-medium">Cursos</th>
                <th className="px-4 py-3 text-left font-medium">Progresso</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">
                  <button
                    onClick={() => setSortBy('risk')}
                    className="inline-flex items-center gap-1 hover:text-pco-deep"
                  >
                    Risco
                    <ArrowUpDown size={10} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const initials = s.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('');
                const enrolledCourses = s.enrolledCourseIds
                  .map((id) => courses.find((c) => c.id === id))
                  .filter(Boolean);
                const avgProgress =
                  Object.values(s.progressByCourse).reduce((a, b) => a + b, 0) /
                  Math.max(1, Object.keys(s.progressByCourse).length);
                return (
                  <tr key={s.id} className="border-t border-surface-gray hover:bg-surface-off">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-pco-deep truncate">{s.name}</div>
                          <div className="text-[11px] text-ink-subtle truncate">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {enrolledCourses.map((c) => (
                          <span
                            key={c!.id}
                            className="pco-badge bg-pco-blue/10 text-pco-blue"
                          >
                            {c!.shortTitle}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-ink-muted mb-1">
                        {Math.round(avgProgress)}% médio
                      </div>
                      <div className="h-1.5 w-24 rounded-full bg-surface-gray overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                          style={{ width: `${avgProgress}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`pco-badge ${statusStyles[s.status]}`}>
                        {statusLabel[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-pco-deep">{s.riskScore}</span>
                        <div className="h-1.5 w-12 rounded-full bg-surface-gray overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.riskScore >= 75
                                ? 'bg-status-danger'
                                : s.riskScore >= 55
                                  ? 'bg-pco-orange'
                                  : s.riskScore >= 30
                                    ? 'bg-pco-blue'
                                    : 'bg-status-success'
                            }`}
                            style={{ width: `${s.riskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {new Date(s.lastAccessAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/admin/alunos/${s.id}`}
                          className="pco-btn-ghost text-xs px-2.5"
                          title="Ver perfil"
                        >
                          <Eye size={12} strokeWidth={1.75} />
                        </Link>
                        <button className="pco-btn-ghost text-xs px-2.5" title="Enviar e-mail">
                          <Mail size={12} strokeWidth={1.75} />
                        </button>
                        <button
                          className="pco-btn-ghost text-xs px-2.5"
                          title={s.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                        >
                          {s.status === 'bloqueado' ? (
                            <Unlock size={12} strokeWidth={1.75} className="text-status-success" />
                          ) : (
                            <Lock size={12} strokeWidth={1.75} className="text-status-danger" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Nenhum aluno encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green' | 'orange' | 'danger';
}) {
  const accentText =
    accent === 'green'
      ? 'text-status-success'
      : accent === 'orange'
        ? 'text-pco-orange'
        : accent === 'danger'
          ? 'text-status-danger'
          : 'text-pco-deep';
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tracking-tight ${accentText}`}>{value}</div>
    </div>
  );
}
