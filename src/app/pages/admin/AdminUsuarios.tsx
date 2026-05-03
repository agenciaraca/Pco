import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Key,
  X,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Power,
  ShieldCheck,
  UserCog,
  GraduationCap,
} from 'lucide-react';
import {
  useSystemUsers,
  useCreateSystemUser,
  useUpdateSystemUser,
  useDeleteSystemUser,
  useChangeSystemUserPassword,
} from '../../data/hooks';
import { useAuth } from '../../auth/AuthContext';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import {
  createSystemUserSchema,
  updateSystemUserSchema,
  changePasswordSchema,
  type CreateSystemUserInput,
  type UpdateSystemUserInput,
  type ChangePasswordInput,
} from '../../../../shared/schemas';
import type { SystemUser } from '../../data/api';

const roleStyles: Record<string, string> = {
  superadmin: 'bg-status-danger/15 text-status-danger',
  admin: 'bg-pco-blue/10 text-pco-blue',
  student: 'bg-status-success/10 text-status-success',
};
const roleLabel: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  student: 'Aluno',
};
const roleIcon: Record<string, React.ReactNode> = {
  superadmin: <ShieldCheck size={12} strokeWidth={2} />,
  admin: <UserCog size={12} strokeWidth={2} />,
  student: <GraduationCap size={12} strokeWidth={2} />,
};

function genStrongPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%*-_+=';
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => alphabet[b % alphabet.length]).join('');
}

export default function AdminUsuarios() {
  const toast = useToast();
  const { user: actingUser } = useAuth();
  const isSuperadmin = actingUser?.role === 'superadmin';

  const usersQ = useSystemUsers();
  const createMut = useCreateSystemUser();
  const updateMut = useUpdateSystemUser();
  const deleteMut = useDeleteSystemUser();
  const passwordMut = useChangeSystemUserPassword();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [editing, setEditing] = useState<SystemUser | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SystemUser | null>(null);
  const [resetting, setResetting] = useState<SystemUser | null>(null);

  const filtered = useMemo(() => {
    let list = usersQ.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'todos') list = list.filter((u) => u.role === roleFilter);
    return list;
  }, [usersQ.data, search, roleFilter]);

  const totals = useMemo(() => {
    const list = usersQ.data ?? [];
    return {
      total: list.length,
      superadmins: list.filter((u) => u.role === 'superadmin').length,
      admins: list.filter((u) => u.role === 'admin').length,
      students: list.filter((u) => u.role === 'student').length,
    };
  }, [usersQ.data]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Usuário excluído', confirmDelete.email);
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  const toggleActive = async (u: SystemUser) => {
    try {
      await updateMut.mutateAsync({ id: u.id, patch: { active: !u.active } });
      toast.success(u.active ? 'Usuário desativado' : 'Usuário ativado', u.email);
    } catch (err) {
      toast.error('Falha ao atualizar', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Usuários do Sistema</h1>
          <p className="pco-section-subtitle mt-1">
            Contas de acesso, papéis (superadmin / admin / aluno) e senhas.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo usuário
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total" value={totals.total} />
        <Stat label="Superadmins" value={totals.superadmins} accent="danger" />
        <Stat label="Admins" value={totals.admins} accent="blue" />
        <Stat label="Alunos" value={totals.students} accent="green" />
      </div>

      <div className="pco-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            size={14}
            strokeWidth={1.75}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou e-mail..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os papéis</option>
          <option value="superadmin">Superadmin</option>
          <option value="admin">Admin</option>
          <option value="student">Aluno</option>
        </select>
      </div>

      {usersQ.isLoading && <CardListSkeleton count={3} />}
      {usersQ.isError && (
        <div className="pco-card">
          <ErrorState
            description="Você precisa estar autenticado como admin/superadmin para listar usuários."
            action={
              <button onClick={() => usersQ.refetch()} className="pco-btn-primary text-xs">
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {!usersQ.isLoading && !usersQ.isError && filtered.length === 0 && (
        <div className="pco-card">
          <EmptyState title="Nenhum usuário" description="Clique em Novo usuário para começar." />
        </div>
      )}

      {filtered.length > 0 && (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-4 py-3 text-left font-medium">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium">Papel</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Último login</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const initials = u.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const isMe = actingUser?.id === u.id;
                  return (
                    <tr key={u.id} className="border-t border-surface-gray hover:bg-surface-off">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-pco-deep">
                              {u.name}
                              {isMe && (
                                <span className="ml-2 text-[10px] text-pco-blue">(você)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-subtle">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`pco-badge ${roleStyles[u.role]}`}>
                          {roleIcon[u.role]}
                          {roleLabel[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`pco-badge ${
                            u.active
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-surface-gray text-ink-muted'
                          }`}
                        >
                          <Power size={10} strokeWidth={2} />
                          {u.active ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString('pt-BR')
                          : 'Nunca'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(u)}
                            className="pco-btn-ghost text-xs px-2.5"
                            title="Editar"
                          >
                            <Edit3 size={12} strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => setResetting(u)}
                            className="pco-btn-ghost text-xs px-2.5"
                            title="Trocar senha"
                          >
                            <Key size={12} strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            className="pco-btn-ghost text-xs px-2.5"
                            title={u.active ? 'Desativar' : 'Ativar'}
                          >
                            <Power
                              size={12}
                              strokeWidth={1.75}
                              className={u.active ? 'text-status-danger' : 'text-status-success'}
                            />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(u)}
                            disabled={isMe}
                            className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10 disabled:opacity-40"
                            title={isMe ? 'Não pode excluir a si mesmo' : 'Excluir'}
                          >
                            <Trash2 size={12} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <UserEditor
          user={editing === 'new' ? null : editing}
          isSuperadmin={isSuperadmin}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            try {
              if (editing === 'new') {
                await createMut.mutateAsync(data as CreateSystemUserInput);
                toast.success('Usuário criado', (data as CreateSystemUserInput).email);
              } else {
                const { ...patch } = data as UpdateSystemUserInput;
                await updateMut.mutateAsync({ id: editing.id, patch });
                toast.success('Usuário atualizado', editing.email);
              }
              setEditing(null);
            } catch (err) {
              toast.error(
                editing === 'new' ? 'Falha ao criar' : 'Falha ao atualizar',
                err instanceof Error ? err.message : 'Erro',
              );
            }
          }}
        />
      )}

      {resetting && (
        <PasswordResetter
          user={resetting}
          submitting={passwordMut.isPending}
          onClose={() => setResetting(null)}
          onSubmit={async (data) => {
            try {
              await passwordMut.mutateAsync({ id: resetting.id, password: data.password });
              toast.success('Senha alterada', resetting.email);
              setResetting(null);
            } catch (err) {
              toast.error('Falha ao trocar senha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir usuário?"
        description={
          confirmDelete && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDelete.email}</span> perderá
              o acesso ao sistema. Esta ação é irreversível.
            </>
          )
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
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
  accent?: 'danger' | 'blue' | 'green';
}) {
  const color =
    accent === 'danger'
      ? 'text-status-danger'
      : accent === 'blue'
        ? 'text-pco-blue'
        : accent === 'green'
          ? 'text-status-success'
          : 'text-pco-deep';
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

interface UserEditorProps {
  user: SystemUser | null;
  isSuperadmin: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSystemUserInput | UpdateSystemUserInput) => Promise<void>;
}

function UserEditor({ user, isSuperadmin, submitting, onClose, onSubmit }: UserEditorProps) {
  const isNew = user === null;
  const [showPwd, setShowPwd] = useState(false);
  const schema = isNew ? createSystemUserSchema : updateSystemUserSchema;
  type FormInput = z.input<typeof createSystemUserSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormInput, unknown, CreateSystemUserInput | UpdateSystemUserInput>({
    // @ts-expect-error — schema is one of two compatible Zod schemas
    resolver: zodResolver(schema),
    defaultValues: {
      email: user?.email ?? '',
      name: user?.name ?? '',
      role: user?.role ?? 'student',
      password: isNew ? genStrongPassword() : '',
      active: user?.active ?? true,
    },
  });

  const passwordValue = watch('password' as 'password');

  return (
    <ModalShell
      title={isNew ? 'Novo usuário' : 'Editar usuário'}
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
        <Field label="Nome" error={errors.name?.message}>
          <input {...register('name')} className="pco-input" />
        </Field>

        <Field label="E-mail" error={errors.email?.message}>
          <input type="email" {...register('email')} className="pco-input" />
        </Field>

        <Field label="Papel" error={errors.role?.message}>
          <select {...register('role')} className="pco-input" disabled={!isSuperadmin}>
            <option value="student">Aluno</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          {!isSuperadmin && (
            <p className="mt-1 text-[11px] text-ink-subtle">
              Apenas superadmin pode mudar papel.
            </p>
          )}
        </Field>

        {isNew && (
          <Field
            label="Senha inicial"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error={(errors as any).password?.message}
          >
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                {...register('password' as 'password')}
                className="pco-input pr-20 font-mono text-xs"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setValue('password' as 'password', genStrongPassword())}
                  className="text-[10px] text-pco-blue hover:underline px-2"
                  title="Gerar nova senha"
                >
                  Gerar
                </button>
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="text-ink-subtle hover:text-pco-blue h-7 w-7 grid place-items-center"
                  aria-label={showPwd ? 'Ocultar' : 'Mostrar'}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {passwordValue && (
              <p className="mt-1 text-[11px] text-ink-subtle">
                Anote esta senha — ela não será mostrada de novo.
              </p>
            )}
          </Field>
        )}

        <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
          <input
            type="checkbox"
            {...register('active')}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          <span className="text-sm text-pco-deep font-medium">Conta ativa</span>
        </label>

        <ModalFooter onClose={onClose} submitting={submitting} isNew={isNew} entityLabel="usuário" />
      </form>
    </ModalShell>
  );
}

interface PasswordResetterProps {
  user: SystemUser;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: ChangePasswordInput) => Promise<void>;
}

function PasswordResetter({ user, submitting, onClose, onSubmit }: PasswordResetterProps) {
  const [showPwd, setShowPwd] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: genStrongPassword() },
  });
  const value = watch('password');

  return (
    <ModalShell
      title="Trocar senha"
      subtitle={user.email}
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
        <Field label="Nova senha" error={errors.password?.message}>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              {...register('password')}
              className="pco-input pr-20 font-mono text-xs"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setValue('password', genStrongPassword())}
                className="text-[10px] text-pco-blue hover:underline px-2"
              >
                Gerar
              </button>
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="text-ink-subtle hover:text-pco-blue h-7 w-7 grid place-items-center"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-ink-subtle">
            Mínimo 8 caracteres. Anote — não será exibida novamente.
          </p>
        </Field>

        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value)}
          className="pco-btn-secondary text-xs"
        >
          Copiar senha
        </button>

        <ModalFooter onClose={onClose} submitting={submitting} isNew={false} entityLabel="senha" />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  subtitle,
  submitting,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  submitting: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            {subtitle && (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {subtitle}
              </div>
            )}
            <h2 className="text-lg font-bold text-pco-deep">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  submitting,
  isNew,
  entityLabel,
}: {
  onClose: () => void;
  submitting: boolean;
  isNew: boolean;
  entityLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
      <button type="button" onClick={onClose} className="pco-btn-ghost text-xs" disabled={submitting}>
        Cancelar
      </button>
      <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {isNew ? `Criar ${entityLabel}` : 'Salvar'}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
    </label>
  );
}
