import { useState } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  Ban,
  Copy,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
  useDeleteApiToken,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { ApiTokenScopeDto } from '../../data/api';
import { useT } from '../../i18n';

const SCOPE_LABELS: Record<ApiTokenScopeDto, string> = {
  'stats:read': 'Estatísticas (resumo)',
  'students:read': 'Alunos (read)',
  'orders:read': 'Pedidos (read)',
  'courses:read': 'Cursos (read)',
  'all:read': 'Todos os escopos read',
};

export default function AdminApiTokens() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.apiTokens')} — Admin` });
  const list = useApiTokens();
  const create = useCreateApiToken();
  const revoke = useRevokeApiToken();
  const del = useDeleteApiToken();
  const toast = useToast();

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScopeDto[]>(['stats:read']);
  const [expiresAt, setExpiresAt] = useState('');
  const [justCreated, setJustCreated] = useState<{ secret: string; name: string } | null>(
    null,
  );

  function toggleScope(s: ApiTokenScopeDto) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    if (scopes.length === 0) {
      toast.error('Selecione ao menos um escopo');
      return;
    }
    try {
      const r = await create.mutateAsync({
        name: name.trim(),
        scopes,
        expiresAt: expiresAt
          ? new Date(expiresAt + 'T23:59:59').toISOString()
          : undefined,
      });
      setJustCreated({ secret: r.secret, name: r.token.name });
      setName('');
      setScopes(['stats:read']);
      setExpiresAt('');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <KeyRound size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.apiTokens')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Tokens read-only para integrações externas (BI, Zapier, n8n, dashboards).
          Endpoints disponíveis em <code>/api/v1/*</code>. Auth: <code>Authorization:
          Bearer pcok_...</code>.
        </p>
      </header>

      <section className="pco-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Plus size={14} strokeWidth={2} className="text-pco-blue" />
          Novo token
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: BI Looker Studio"
              className="pco-input text-sm"
            />
          </Field>
          <Field label="Expira em (opcional)">
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="pco-input text-sm"
            />
          </Field>
        </div>
        <Field label="Escopos">
          <div className="grid gap-2 sm:grid-cols-2 mt-1">
            {(Object.keys(SCOPE_LABELS) as ApiTokenScopeDto[]).map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-xs p-2 rounded border border-pco-border hover:bg-surface-mute cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={() => toggleScope(s)}
                  className="accent-pco-blue"
                />
                <div className="flex-1">
                  <code>{s}</code>
                  <div className="text-ink-subtle">{SCOPE_LABELS[s]}</div>
                </div>
              </label>
            ))}
          </div>
        </Field>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={create.isPending}
            className="pco-btn-primary text-xs"
          >
            <KeyRound size={11} strokeWidth={2} />
            {create.isPending ? 'Criando...' : 'Gerar token'}
          </button>
        </div>
      </section>

      {justCreated && (
        <section className="pco-card border-pco-blue/30 bg-pco-blue/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-pco-deep font-semibold">
            <CheckCircle2 size={16} className="text-status-success" />
            Token criado: {justCreated.name}
          </div>
          <p className="text-xs text-status-danger flex items-start gap-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>
              <strong>Copie agora!</strong> O segredo não será mostrado novamente. Se
              perder, gere outro.
            </span>
          </p>
          <code className="block font-mono text-sm bg-white border border-pco-border rounded p-3 break-all select-all">
            {justCreated.secret}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(justCreated.secret);
                toast.info('Copiado');
              }}
              className="pco-btn-ghost text-xs"
            >
              <Copy size={11} strokeWidth={2} />
              Copiar
            </button>
            <button
              type="button"
              onClick={() => setJustCreated(null)}
              className="pco-btn-ghost text-xs"
            >
              Já guardei
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-2">Tokens ativos</h2>
        {list.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : (list.data?.tokens ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhum token criado ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {(list.data?.tokens ?? []).map((t) => (
              <li key={t.id} className="pco-card p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-pco-deep">{t.name}</span>
                    {t.active ? (
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        ativo
                      </span>
                    ) : (
                      <span className="pco-badge bg-status-danger/15 text-status-danger">
                        revogado
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-subtle mt-0.5 font-mono">
                    {t.prefix}…
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {t.scopes.join(', ')}
                  </div>
                  <div className="text-xs text-ink-subtle mt-0.5">
                    criado em {new Date(t.createdAt).toLocaleString('pt-BR')} · {t.usageCount}{' '}
                    uso(s)
                    {t.lastUsedAt && (
                      <> · último uso: {new Date(t.lastUsedAt).toLocaleString('pt-BR')}</>
                    )}
                    {t.expiresAt && (
                      <> · expira em {new Date(t.expiresAt).toLocaleDateString('pt-BR')}</>
                    )}
                  </div>
                </div>
                {t.active && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Revogar ${t.name}? Não dá para reativar.`)) return;
                      try {
                        await revoke.mutateAsync(t.id);
                        toast.success('Revogado');
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs text-pco-orange"
                  >
                    <Ban size={11} strokeWidth={2} />
                    Revogar
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Excluir ${t.name}? Permanente.`)) return;
                    try {
                      await del.mutateAsync(t.id);
                      toast.success('Removido');
                    } catch (err) {
                      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
                    }
                  }}
                  className="pco-btn-ghost text-xs text-status-danger"
                >
                  <Trash2 size={11} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pco-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-pco-deep">Endpoints disponíveis</h2>
        <ul className="text-xs space-y-1 text-ink-muted">
          <li>
            <code>GET /api/v1/me</code> — info do token
          </li>
          <li>
            <code>GET /api/v1/stats/summary</code> — resumo (escopo: stats:read)
          </li>
          <li>
            <code>GET /api/v1/students?limit=100</code> — lista alunos (escopo: students:read)
          </li>
          <li>
            <code>GET /api/v1/orders?status=paid&amp;limit=100</code> — lista pedidos
            (escopo: orders:read)
          </li>
          <li>
            <code>GET /api/v1/courses</code> — lista cursos (escopo: courses:read)
          </li>
        </ul>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
