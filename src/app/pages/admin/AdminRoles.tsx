import { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Lock,
  X,
  Save,
  Grid3x3,
  List as ListIcon,
} from 'lucide-react';
import {
  useRoles,
  usePermissionsCatalog,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import type { RoleDto } from '../../data/api';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

interface EditState {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  permissions: Set<string>;
  tier: 'student' | 'admin' | 'superadmin';
}

const EMPTY_EDIT: EditState = {
  id: null,
  slug: '',
  name: '',
  description: '',
  permissions: new Set(),
  tier: 'student',
};

export default function AdminRoles() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.roles')} — Admin` });
  const rolesQ = useRoles();
  const permsQ = usePermissionsCatalog();
  const createMut = useCreateRole();
  const updateMut = useUpdateRole();
  const deleteMut = useDeleteRole();
  const toast = useToast();

  const [editing, setEditing] = useState<EditState | null>(null);
  const [view, setView] = useState<'list' | 'matrix'>('list');

  const allPerms = useMemo(() => {
    const sys = permsQ.data?.system ?? [];
    const cust = permsQ.data?.custom ?? [];
    return [...sys, ...cust];
  }, [permsQ.data]);

  /** Agrupa permissões por categoria pra renderizar na UI. */
  const groupedPerms = useMemo(() => {
    const meta = permsQ.data?.meta ?? {};
    const groups = permsQ.data?.groups ?? [];
    type Item = { code: string; label: string; description?: string };
    const buckets = new Map<string, Item[]>();
    for (const code of allPerms) {
      const m = meta[code];
      const groupName = m?.group ?? 'Outros';
      const item: Item = {
        code,
        label: m?.label ?? code,
        description: m?.description,
      };
      const list = buckets.get(groupName) ?? [];
      list.push(item);
      buckets.set(groupName, list);
    }
    // Preserva ordem dos grupos canônicos + grupos customs ao final
    const ordered: { name: string; items: Item[] }[] = [];
    for (const g of groups) {
      const items = buckets.get(g);
      if (items?.length) {
        ordered.push({ name: g, items });
        buckets.delete(g);
      }
    }
    for (const [name, items] of buckets) {
      ordered.push({ name, items });
    }
    return ordered;
  }, [allPerms, permsQ.data]);

  /** Helper pra mostrar label humana de uma permission code (usado na lista de roles). */
  function permLabel(code: string): string {
    return permsQ.data?.meta[code]?.label ?? code;
  }

  function selectAllInGroup(items: { code: string }[]) {
    if (!editing) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.permissions);
      for (const item of items) next.add(item.code);
      return { ...prev, permissions: next };
    });
  }

  function clearAllInGroup(items: { code: string }[]) {
    if (!editing) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.permissions);
      for (const item of items) next.delete(item.code);
      return { ...prev, permissions: next };
    });
  }

  function openCreate() {
    setEditing({ ...EMPTY_EDIT, permissions: new Set() });
  }

  function openEdit(role: RoleDto) {
    setEditing({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      permissions: new Set(role.permissions),
      tier: role.tier ?? 'student',
    });
  }

  function close() {
    setEditing(null);
  }

  function togglePerm(p: string) {
    if (!editing) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.permissions);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...prev, permissions: next };
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    const payload = {
      name: editing.name.trim(),
      description: editing.description.trim(),
      permissions: Array.from(editing.permissions),
      tier: editing.tier,
    };
    try {
      if (editing.id) {
        await updateMut.mutateAsync({ id: editing.id, patch: payload });
        toast.success('Papel atualizado');
      } else {
        if (!editing.slug.trim()) {
          toast.error('Slug obrigatório para novos papéis');
          return;
        }
        await createMut.mutateAsync({
          slug: editing.slug.trim(),
          ...payload,
        });
        toast.success('Papel criado');
      }
      close();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDelete(role: RoleDto) {
    if (role.system) return;
    if (!confirm(`Excluir o papel "${role.name}"? Essa ação é permanente.`)) return;
    try {
      await deleteMut.mutateAsync(role.id);
      toast.success('Papel removido');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const roles = rolesQ.data?.roles ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <ShieldCheck size={20} className="text-pco-blue" strokeWidth={1.75} />
            {t('admin.nav.roles')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Catálogo único de papéis. Você pode criar, editar e excluir papéis
            livremente — apenas o <strong>superadmin</strong> é imutável, e{' '}
            <strong>student</strong>/<strong>admin</strong> não podem ser
            deletados (a autenticação do sistema depende deles).
          </p>

          {/*
            **A tela precisa dizer o que ela é, porque o que ela parece é outra
            coisa.**

            As permissões marcadas aqui são gravadas e listadas — e **nenhuma
            rota do servidor as consulta**. Quem decide o acesso é o campo
            `role` da conta (`student` / `admin` / `superadmin`), lido do token
            por `requireAuth`. Um papel "atendente" com três permissões marcadas
            não restringe nada: se a conta é `admin`, ela alcança todo
            `/admin/*`.

            Isso é uma frase na tela, e não uma correção de código, porque
            implementar autorização por permissão significa declarar uma
            permissão em cada rota de administração — decisão de produto, com
            risco real de trancar o operador para fora enquanto se acerta o
            mapa. O que não pode continuar é a tela **implicar** um controle que
            não existe: quem marca três caixinhas e sai achando que limitou o
            acesso de alguém tomou uma decisão de segurança com base numa
            informação falsa.

            `test/papeis-nao-prometem-o-que-nao-cumprem.test.ts` trava as duas
            metades: que nenhuma rota lê `permissions`, e que este aviso está
            aqui. No dia em que a autorização por permissão for implementada, o
            teste falha — e o aviso sai junto.
          */}
          <p className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-xs text-ink-muted">
            <strong className="text-pco-deep">
              As permissões abaixo são descritivas, não restritivas.
            </strong>{' '}
            Elas documentam o que se espera de cada papel e{' '}
            <strong>não são verificadas pelo servidor</strong>. Quem decide o
            acesso hoje é o tipo da conta — <strong>aluno</strong>,{' '}
            <strong>admin</strong> ou <strong>superadmin</strong> —, e qualquer
            conta marcada como admin alcança todo o painel, independentemente do
            papel atribuído a ela. Para limitar de verdade o que alguém faz,
            hoje o caminho é não dar admin a ela.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div
            role="tablist"
            aria-label="Modo de visualização"
            className="inline-flex rounded-lg border border-pco-border bg-white overflow-hidden"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              onClick={() => setView('list')}
              className={`text-xs px-3 py-1.5 inline-flex items-center gap-1 ${
                view === 'list'
                  ? 'bg-pco-blue text-white'
                  : 'text-ink-muted hover:bg-surface-mute'
              }`}
            >
              <ListIcon size={12} strokeWidth={2} />
              Lista
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'matrix'}
              onClick={() => setView('matrix')}
              className={`text-xs px-3 py-1.5 inline-flex items-center gap-1 ${
                view === 'matrix'
                  ? 'bg-pco-blue text-white'
                  : 'text-ink-muted hover:bg-surface-mute'
              }`}
            >
              <Grid3x3 size={12} strokeWidth={2} />
              Matriz
            </button>
          </div>
          <button type="button" onClick={openCreate} className="pco-btn-primary text-xs">
            <Plus size={12} strokeWidth={2} />
            Novo papel
          </button>
        </div>
      </header>

      {rolesQ.fetchStatus === 'paused' ? (
        <SemConexao oQue="os papéis" />
      ) : rolesQ.isError ? (
        <FalhaAoCarregar
          erro={rolesQ.error}
          oQue="os papéis"
          aoTentarDeNovo={() => void rolesQ.refetch()}
        />
      ) : rolesQ.isPending ? (
        <div className="text-sm text-ink-muted">Carregando…</div>
      ) : roles.length === 0 ? (
        <div className="pco-card p-6 text-center text-sm text-ink-muted">
          Nenhum papel cadastrado.
        </div>
      ) : view === 'matrix' ? (
        <PermissionMatrix
          roles={roles}
          groupedPerms={groupedPerms}
          allPerms={allPerms}
        />
      ) : (
        <ul className="space-y-3">
          {roles.map((role) => (
            <li key={role.id} className="pco-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-pco-deep">
                      {role.name}
                    </span>
                    <code className="text-xs bg-surface-mute px-1.5 py-0.5 rounded text-ink-muted">
                      {role.slug}
                    </code>
                    {role.slug === 'superadmin' && (
                      <span
                        className="pco-badge bg-pco-blue/10 text-pco-blue inline-flex items-center gap-1"
                        title="Imutável — auth do sistema depende"
                      >
                        <Lock size={10} strokeWidth={2} />
                        imutável
                      </span>
                    )}
                    {typeof role.userCount === 'number' && role.userCount > 0 && (
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        {role.userCount} usuário{role.userCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-ink-muted mt-1">{role.description}</p>
                  )}
                  <div className="text-xs text-ink-subtle mt-2">
                    {role.permissions.length} permissão(ões)
                    {typeof role.userCount === 'number' && (
                      <> · {role.userCount} usuário{role.userCount === 1 ? '' : 's'} atribuído{role.userCount === 1 ? '' : 's'}</>
                    )}
                  </div>
                  {role.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {role.permissions.slice(0, 12).map((p) => (
                        <span
                          key={p}
                          title={p}
                          className="text-xs bg-surface-off px-2 py-0.5 rounded text-ink-muted border border-pco-border"
                        >
                          {permLabel(p)}
                        </span>
                      ))}
                      {role.permissions.length > 12 && (
                        <span className="text-xs text-ink-subtle px-2 py-0.5">
                          +{role.permissions.length - 12} mais
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(role)}
                    disabled={role.slug === 'superadmin'}
                    title={
                      role.slug === 'superadmin'
                        ? 'Superadmin é imutável (sempre tem todas as permissões)'
                        : 'Editar'
                    }
                    className="pco-btn-ghost text-xs disabled:opacity-40"
                  >
                    <Pencil size={11} strokeWidth={2} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(role)}
                    disabled={
                      role.slug === 'superadmin' ||
                      role.slug === 'admin' ||
                      role.slug === 'student'
                    }
                    title={
                      role.slug === 'superadmin' ||
                      role.slug === 'admin' ||
                      role.slug === 'student'
                        ? 'Roles base do sistema (student/admin/superadmin) não podem ser deletadas'
                        : 'Excluir'
                    }
                    className="pco-btn-ghost text-xs text-status-danger disabled:opacity-40"
                  >
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-label={editing.id ? 'Editar papel' : 'Novo papel'}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
          >
            <header className="flex items-center justify-between p-4 border-b border-pco-border">
              <h2 className="text-lg font-bold text-pco-deep">
                {editing.id ? 'Editar papel' : 'Novo papel'}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-ink-muted hover:text-pco-deep"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-ink-muted">
                    Slug (identificador)
                  </span>
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev ? { ...prev, slug: e.target.value } : prev,
                      )
                    }
                    disabled={!!editing.id}
                    placeholder="ex: mentor"
                    className="pco-input text-sm mt-1 disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-ink-muted">
                    Nome
                  </span>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                    placeholder="ex: Mentor"
                    className="pco-input text-sm mt-1"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  Descrição
                </span>
                <textarea
                  value={editing.description}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev,
                    )
                  }
                  rows={2}
                  placeholder="O que esse papel representa?"
                  className="pco-input text-sm mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  Tier de auth (nível de acesso)
                </span>
                <select
                  value={editing.tier}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            tier: e.target.value as 'student' | 'admin' | 'superadmin',
                          }
                        : prev,
                    )
                  }
                  disabled={
                    editing.slug === 'student' ||
                    editing.slug === 'admin' ||
                    editing.slug === 'superadmin'
                  }
                  className="pco-input text-sm mt-1 disabled:opacity-60"
                >
                  <option value="student">Aluno (acesso de aluno)</option>
                  <option value="admin">Admin (acesso administrativo)</option>
                  <option value="superadmin">
                    Superadmin (acesso total)
                  </option>
                </select>
                <p className="mt-1 text-xs text-ink-subtle">
                  Determina o que o middleware aceita em rotas protegidas.
                  Para "atendentes" e "operadores" geralmente é Admin.
                  Roles base (student/admin/superadmin) têm tier fixo.
                </p>
              </label>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">
                    Permissões ({editing.permissions.size} selecionada{editing.permissions.size === 1 ? '' : 's'} de {allPerms.length})
                  </div>
                </div>
                <div className="space-y-4">
                  {groupedPerms.map((group) => {
                    const selectedInGroup = group.items.filter((it) =>
                      editing.permissions.has(it.code),
                    ).length;
                    const allSelected = selectedInGroup === group.items.length;
                    return (
                      <fieldset
                        key={group.name}
                        className="border border-pco-border rounded-lg p-3"
                      >
                        <legend className="px-2 text-xs font-semibold text-pco-deep flex items-center gap-2">
                          {group.name}
                          <span className="text-xs text-ink-subtle font-normal">
                            ({selectedInGroup}/{group.items.length})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              allSelected
                                ? clearAllInGroup(group.items)
                                : selectAllInGroup(group.items)
                            }
                            className="text-xs text-pco-blue hover:underline ml-2 font-normal"
                          >
                            {allSelected ? 'Limpar todos' : 'Marcar todos'}
                          </button>
                        </legend>
                        <div className="grid gap-1 sm:grid-cols-2 mt-1">
                          {group.items.map((item) => (
                            <label
                              key={item.code}
                              className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-surface-mute cursor-pointer"
                              title={item.code}
                            >
                              <input
                                type="checkbox"
                                checked={editing.permissions.has(item.code)}
                                onChange={() => togglePerm(item.code)}
                                className="accent-pco-blue mt-0.5"
                              />
                              <span className="flex-1 min-w-0">
                                <span className="block leading-snug text-ink-strong">
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span className="block text-xs text-ink-subtle mt-0.5">
                                    {item.description}
                                  </span>
                                )}
                                <code className="block text-[9px] text-ink-subtle mt-0.5 font-mono opacity-60">
                                  {item.code}
                                </code>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
                <p className="text-xs text-ink-subtle mt-3">
                  Hoje as permissões servem como <strong>documentação versionada</strong> —
                  a autorização efetiva continua usando os 3 papéis do sistema
                  (aluno, admin, superadmin). Quando RBAC dinâmico for ativado,
                  esse mapeamento passa a ser enforçado em todas as rotas.
                </p>
              </div>
            </div>

            <footer className="flex justify-end gap-2 p-4 border-t border-pco-border">
              <button type="button" onClick={close} className="pco-btn-ghost text-xs">
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={createMut.isPending || updateMut.isPending}
                className="pco-btn-primary text-xs"
              >
                <Save size={11} strokeWidth={2} />
                {editing.id ? 'Salvar' : 'Criar papel'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Permission matrix — comparativo lado a lado de roles × grupos de permissão
// ─────────────────────────────────────────────────────────────────────────

interface MatrixGroup {
  name: string;
  items: { code: string; label: string; description?: string }[];
}

function PermissionMatrix({
  roles,
  groupedPerms,
  allPerms,
}: {
  roles: RoleDto[];
  groupedPerms: MatrixGroup[];
  allPerms: string[];
}) {
  return (
    <div className="pco-card overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface-off z-10">
          <tr>
            <th
              scope="col"
              className="text-left p-3 font-semibold text-ink-muted border-b border-pco-border min-w-[180px]"
            >
              Grupo de permissões
            </th>
            {roles.map((r) => (
              <th
                key={r.id}
                scope="col"
                className="text-center p-3 font-semibold text-pco-deep border-b border-pco-border min-w-[120px]"
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{r.name}</span>
                  {r.slug === 'superadmin' && (
                    <span className="text-[9px] uppercase tracking-wider text-pco-blue inline-flex items-center gap-1">
                      <Lock size={9} strokeWidth={2} />
                      imutável
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedPerms.map((group) => (
            <tr key={group.name} className="border-b border-pco-border last:border-0">
              <th
                scope="row"
                className="text-left p-3 font-medium text-ink-strong align-top"
              >
                <div>{group.name}</div>
                <div className="text-xs text-ink-subtle font-normal mt-0.5">
                  {group.items.length} permissão{group.items.length === 1 ? '' : 'ões'}
                </div>
              </th>
              {roles.map((r) => {
                const granted = group.items.filter((it) =>
                  r.permissions.includes(it.code),
                ).length;
                const total = group.items.length;
                const pct = total ? granted / total : 0;
                const color =
                  granted === 0
                    ? 'bg-surface-mute text-ink-subtle'
                    : pct === 1
                      ? 'bg-status-success/15 text-status-success'
                      : pct >= 0.5
                        ? 'bg-pco-blue/10 text-pco-blue'
                        : 'bg-pco-orange/10 text-pco-orange';
                return (
                  <td key={r.id} className="text-center p-2 align-middle">
                    <span
                      title={`${granted} de ${total} concedidas`}
                      className={`inline-flex items-center justify-center font-semibold rounded px-2 py-0.5 min-w-[44px] ${color}`}
                    >
                      {granted}
                      <span className="opacity-50 mx-0.5">/</span>
                      {total}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-pco-deep bg-surface-off">
            <th scope="row" className="text-left p-3 font-bold text-pco-deep">
              Total
            </th>
            {roles.map((r) => (
              <td key={r.id} className="text-center p-3">
                <span className="font-bold text-pco-deep">{r.permissions.length}</span>
                <span className="opacity-50 mx-0.5">/</span>
                <span className="text-ink-subtle">{allPerms.length}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
