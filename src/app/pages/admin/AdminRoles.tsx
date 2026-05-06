import { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Lock,
  X,
  Save,
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
import type { RoleDto } from '../../data/api';

interface EditState {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  permissions: Set<string>;
}

const EMPTY_EDIT: EditState = {
  id: null,
  slug: '',
  name: '',
  description: '',
  permissions: new Set(),
};

export default function AdminRoles() {
  useDocumentMeta({ title: 'Papéis e permissões — Admin' });
  const rolesQ = useRoles();
  const permsQ = usePermissionsCatalog();
  const createMut = useCreateRole();
  const updateMut = useUpdateRole();
  const deleteMut = useDeleteRole();
  const toast = useToast();

  const [editing, setEditing] = useState<EditState | null>(null);

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
            Papéis e permissões
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Inventário de papéis do sistema e permissões nominais. Os 3 papéis
            do sistema (aluno, admin, superadmin) são imutáveis. Você pode criar
            papéis personalizados para documentar convenções da equipe.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo papel
        </button>
      </header>

      {rolesQ.isLoading ? (
        <div className="text-sm text-ink-muted">Carregando…</div>
      ) : roles.length === 0 ? (
        <div className="pco-card p-6 text-center text-sm text-ink-muted">
          Nenhum papel cadastrado.
        </div>
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
                    <code className="text-[11px] bg-surface-mute px-1.5 py-0.5 rounded text-ink-muted">
                      {role.slug}
                    </code>
                    {role.system && (
                      <span className="pco-badge bg-pco-blue/10 text-pco-blue inline-flex items-center gap-1">
                        <Lock size={10} strokeWidth={2} />
                        sistema
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
                  <div className="text-[11px] text-ink-subtle mt-2">
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
                          className="text-[11px] bg-surface-off px-2 py-0.5 rounded text-ink-muted border border-pco-border"
                        >
                          {permLabel(p)}
                        </span>
                      ))}
                      {role.permissions.length > 12 && (
                        <span className="text-[11px] text-ink-subtle px-2 py-0.5">
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
                    disabled={role.system}
                    title={role.system ? 'Papéis do sistema são imutáveis' : 'Editar'}
                    className="pco-btn-ghost text-xs disabled:opacity-40"
                  >
                    <Pencil size={11} strokeWidth={2} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(role)}
                    disabled={role.system}
                    title={role.system ? 'Papéis do sistema são imutáveis' : 'Excluir'}
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
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
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
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
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
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
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
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted">
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
                          <span className="text-[10px] text-ink-subtle font-normal">
                            ({selectedInGroup}/{group.items.length})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              allSelected
                                ? clearAllInGroup(group.items)
                                : selectAllInGroup(group.items)
                            }
                            className="text-[10px] text-pco-blue hover:underline ml-2 font-normal"
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
                                  <span className="block text-[10px] text-ink-subtle mt-0.5">
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
                <p className="text-[11px] text-ink-subtle mt-3">
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
