import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  UserCog,
  GraduationCap,
  Mail,
  Calendar,
  Clock,
  KeyRound,
  Activity,
  Lock,
  Power,
} from 'lucide-react';
import {
  useSystemUser,
  useRoles,
  useAuditLog,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

const roleLabel: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  student: 'Aluno',
};
const roleStyles: Record<string, string> = {
  superadmin: 'bg-status-danger/10 text-status-danger',
  admin: 'bg-pco-blue/10 text-pco-blue',
  student: 'bg-status-success/10 text-status-success',
};
const roleIcon: Record<string, React.ReactNode> = {
  superadmin: <ShieldCheck size={12} strokeWidth={2} />,
  admin: <UserCog size={12} strokeWidth={2} />,
  student: <GraduationCap size={12} strokeWidth={2} />,
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminSystemUserDetail() {
  const { id } = useParams<{ id: string }>();
  useDocumentMeta({ title: 'Detalhes do usuário — Admin' });
  const userQ = useSystemUser(id);
  const rolesQ = useRoles();
  const auditQ = useAuditLog({ actorId: id, limit: 50 });

  if (!id) return <Navigate to="/admin/usuarios" replace />;
  if (userQ.isLoading) return <CardListSkeleton count={3} />;
  if (userQ.isError || !userQ.data) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/usuarios"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar
        </Link>
        <EmptyState
          title="Usuário não encontrado"
          description="O ID informado não corresponde a um usuário do sistema."
        />
      </div>
    );
  }

  const user = userQ.data as typeof userQ.data & { customRoleSlug?: string | null };
  const customRole = user.customRoleSlug
    ? (rolesQ.data?.roles ?? []).find((r) => r.slug === user.customRoleSlug)
    : null;
  const customRolePermissions = customRole?.permissions ?? [];
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const auditEntries = auditQ.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            to="/admin/usuarios"
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={11} strokeWidth={2} />
            Voltar para usuários
          </Link>
          <h1 className="text-2xl font-bold text-pco-deep mt-1">
            Detalhes do usuário
          </h1>
        </div>
      </header>

      <section className="pco-card p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-pco-blue/20 to-pco-cyan/20 grid place-items-center text-pco-deep font-bold text-xl shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-xl font-bold text-pco-deep">{user.name}</h2>
            <p className="text-sm text-ink-muted flex items-center gap-1.5 mt-0.5">
              <Mail size={12} strokeWidth={2} />
              {user.email}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {customRole ? (
                <span
                  className="pco-badge bg-pco-cyan/10 text-pco-cyan"
                  title={`Tier de auth: ${user.role}`}
                >
                  {customRole.name}
                </span>
              ) : (
                <span className={`pco-badge ${roleStyles[user.role]}`}>
                  {roleIcon[user.role]}
                  {roleLabel[user.role]}
                </span>
              )}
              <span
                className={`pco-badge ${
                  user.active
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                <Power size={10} strokeWidth={2} />
                {user.active ? 'Ativo' : 'Desativado'}
              </span>
              {user.totpEnabled && (
                <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                  <KeyRound size={10} strokeWidth={2} />
                  2FA ativo
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="pco-card p-5">
          <h3 className="text-sm font-semibold text-pco-deep mb-3">
            Informações básicas
          </h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-ink-muted">ID</dt>
              <dd className="font-mono text-xs text-ink-strong text-right break-all">
                {user.id}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-ink-muted">Role do sistema</dt>
              <dd className="font-medium text-ink-strong">
                {roleLabel[user.role] ?? user.role}
              </dd>
            </div>
            {user.customRoleSlug && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Papel personalizado</dt>
                <dd className="font-medium text-pco-cyan">
                  {customRole?.name ?? user.customRoleSlug}
                </dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <dt className="text-ink-muted flex items-center gap-1.5">
                <Calendar size={11} strokeWidth={2} />
                Criado em
              </dt>
              <dd className="text-ink-strong">{formatDate(user.createdAt)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-ink-muted flex items-center gap-1.5">
                <Clock size={11} strokeWidth={2} />
                Último acesso
              </dt>
              <dd className="text-ink-strong">{formatDate(user.lastLoginAt)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-ink-muted">Atualizado em</dt>
              <dd className="text-ink-strong">{formatDate(user.updatedAt)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-ink-muted">Token version</dt>
              <dd className="font-mono text-xs text-ink-strong">
                v{user.tokenVersion}
              </dd>
            </div>
          </dl>
        </section>

        <section className="pco-card p-5">
          <h3 className="text-sm font-semibold text-pco-deep mb-3 flex items-center gap-2">
            <Lock size={14} strokeWidth={2} className="text-pco-blue" />
            Permissões {customRole ? '(via papel custom)' : '(via papel sistema)'}
          </h3>
          {customRole ? (
            customRolePermissions.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Papel "{customRole.name}" sem permissões cadastradas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {customRolePermissions.map((p) => (
                  <code
                    key={p}
                    className="text-[10px] bg-surface-off border border-pco-border rounded px-1.5 py-0.5 text-ink-muted"
                  >
                    {p}
                  </code>
                ))}
              </div>
            )
          ) : (
            <p className="text-xs text-ink-muted">
              Permissões enforced pelo middleware via{' '}
              <code>requireAuth('{user.role}')</code>. Detalhes em{' '}
              <Link to="/admin/papeis" className="text-pco-blue hover:underline">
                /admin/papeis
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      <section className="pco-card p-5">
        <h3 className="text-sm font-semibold text-pco-deep mb-3 flex items-center gap-2">
          <Activity size={14} strokeWidth={2} className="text-pco-blue" />
          Atividade recente (audit log)
        </h3>
        {auditQ.isLoading ? (
          <p className="text-xs text-ink-muted">Carregando…</p>
        ) : auditEntries.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Sem ações registradas pra este usuário no log de auditoria.
          </p>
        ) : (
          <ul className="divide-y divide-pco-border">
            {auditEntries.slice(0, 20).map((e) => (
              <li
                key={e.id}
                className="py-2 flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-[11px] text-pco-blue">{e.action}</code>
                  {e.targetId && (
                    <span className="text-[11px] text-ink-subtle ml-2">
                      → {e.targetType}/{e.targetId}
                    </span>
                  )}
                  {e.status === 'error' && (
                    <span className="ml-2 pco-badge bg-status-danger/10 text-status-danger text-[9px]">
                      erro
                    </span>
                  )}
                </div>
                <time className="text-[11px] text-ink-subtle shrink-0">
                  {formatDate(e.ts)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pco-card p-5">
        <h3 className="text-sm font-semibold text-pco-deep mb-3">
          Ações administrativas
        </h3>
        <p className="text-xs text-ink-muted">
          Edição (papel, e-mail, ativar/desativar), reset de senha e force
          logout estão disponíveis em{' '}
          <Link to="/admin/usuarios" className="text-pco-blue hover:underline">
            /admin/usuarios
          </Link>{' '}
          (modal de edição).
        </p>
      </section>
    </div>
  );
}
