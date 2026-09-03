import { useState } from 'react';
import { Pin, PinOff, Trash2, Edit3, Save, X, MessageSquare } from 'lucide-react';
import {
  useAdminNotes,
  useCreateAdminNote,
  useUpdateAdminNote,
  useDeleteAdminNote,
} from '../data/hooks';
import { useToast } from './Toast';

export default function AdminNotesPanel({ studentId }: { studentId: string }) {
  const { data, isLoading } = useAdminNotes(studentId);
  const create = useCreateAdminNote();
  const update = useUpdateAdminNote();
  const del = useDeleteAdminNote();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  async function handleAdd() {
    if (!draft.trim()) return;
    try {
      await create.mutateAsync({ studentId, body: draft.trim(), pinned });
      setDraft('');
      setPinned(false);
      toast.success('Nota adicionada');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      await update.mutateAsync({
        studentId,
        noteId: editing.id,
        patch: { body: editing.body },
      });
      setEditing(null);
      toast.success('Nota atualizada');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <section className="pco-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <MessageSquare size={14} className="text-pco-blue" strokeWidth={1.75} />
        Notas privadas (admin)
      </h3>
      <p className="text-xs text-ink-muted">
        Anotações internas sobre este aluno. Não visíveis ao próprio aluno. Use para
        registrar contatos, observações pedagógicas, exceções administrativas, etc.
      </p>

      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nova nota..."
          className="pco-input text-sm"
          rows={3}
        />
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-pco-blue"
            />
            Fixar no topo
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim() || create.isPending}
            className="pco-btn-primary text-xs"
          >
            {create.isPending ? 'Salvando...' : 'Adicionar nota'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-ink-muted">Carregando...</div>
      ) : (data ?? []).length === 0 ? (
        <div className="text-xs text-ink-muted text-center py-4">Sem notas ainda.</div>
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((n) => (
            <li
              key={n.id}
              className={`rounded-lg p-3 border ${
                n.pinned
                  ? 'border-pco-orange/30 bg-pco-orange/5'
                  : 'border-pco-border bg-white'
              }`}
            >
              {editing?.id === n.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    className="pco-input text-sm"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="pco-btn-ghost text-xs"
                    >
                      <X size={11} />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="pco-btn-primary text-xs"
                    >
                      <Save size={11} />
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-pco-deep whitespace-pre-wrap">{n.body}</div>
                  <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-ink-subtle">
                      por {n.authorEmail} · {new Date(n.createdAt).toLocaleString('pt-BR')}
                      {n.updatedAt !== n.createdAt && ' (editada)'}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          update.mutate({
                            studentId,
                            noteId: n.id,
                            patch: { pinned: !n.pinned },
                          })
                        }
                        className="pco-btn-ghost text-xs"
                        title={n.pinned ? 'Desafixar' : 'Fixar'}
                      >
                        {n.pinned ? (
                          <PinOff size={10} strokeWidth={2} />
                        ) : (
                          <Pin size={10} strokeWidth={2} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ id: n.id, body: n.body })}
                        className="pco-btn-ghost text-xs"
                        title="Editar"
                      >
                        <Edit3 size={10} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Excluir esta nota?')) {
                            del.mutate({ studentId, noteId: n.id });
                          }
                        }}
                        className="pco-btn-ghost text-xs text-status-danger"
                        title="Excluir"
                      >
                        <Trash2 size={10} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
