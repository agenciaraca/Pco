// Barra de filtros salvos. Plugue em qualquer página de listagem com filtros.
// O scope identifica a página; filters é um objeto livre que a página interpreta.

import { useState } from 'react';
import { Bookmark, Plus, X } from 'lucide-react';
import {
  useSavedSearches,
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from '../data/hooks';
import { useToast } from './Toast';
import type { SavedSearchScopeDto } from '../data/api';

interface Props {
  scope: SavedSearchScopeDto;
  // Estado atual dos filtros (passado pela página)
  currentFilters: Record<string, unknown>;
  // Quando o admin clica em um filtro salvo, a página recebe os filtros pra aplicar
  onApply: (filters: Record<string, unknown>) => void;
}

export default function SavedSearchesBar({
  scope,
  currentFilters,
  onApply,
}: Props) {
  const { data = [] } = useSavedSearches(scope);
  const create = useCreateSavedSearch();
  const del = useDeleteSavedSearch();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const isEmpty = Object.keys(currentFilters).length === 0;

  async function handleSave() {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        scope,
        name: name.trim(),
        filters: currentFilters,
      });
      setName('');
      setShowForm(false);
      toast.success('Filtro salvo');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  if (data.length === 0 && !showForm) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Bookmark size={11} strokeWidth={1.75} />
        Sem filtros salvos.
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={isEmpty}
          className="text-pco-blue hover:underline disabled:text-ink-subtle disabled:no-underline"
          title={isEmpty ? 'Aplique filtros antes de salvar' : 'Salvar filtro atual'}
        >
          + salvar filtro atual
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Bookmark size={11} strokeWidth={1.75} className="text-pco-blue" />
      {data.map((s) => (
        <div key={s.id} className="inline-flex items-center">
          <button
            type="button"
            onClick={() => onApply(s.filters)}
            className="pco-badge bg-pco-blue/10 text-pco-blue hover:bg-pco-blue/20"
            title={JSON.stringify(s.filters)}
          >
            {s.name}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Remover filtro "${s.name}"?`)) return;
              try {
                await del.mutateAsync(s.id);
                toast.success('Removido');
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            className="ml-0.5 text-ink-subtle hover:text-status-danger"
            title="Remover"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
      ))}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={isEmpty}
          className="text-pco-blue hover:underline disabled:text-ink-subtle disabled:no-underline inline-flex items-center gap-1"
          title={isEmpty ? 'Aplique filtros antes de salvar' : 'Salvar filtro atual'}
        >
          <Plus size={10} strokeWidth={2} />
          salvar atual
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do filtro"
            className="pco-input text-xs h-6 w-32"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
              if (e.key === 'Escape') {
                setShowForm(false);
                setName('');
              }
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || create.isPending}
            className="text-pco-blue hover:underline"
          >
            salvar
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setName('');
            }}
            className="text-ink-subtle hover:text-pco-deep"
          >
            <X size={10} />
          </button>
        </span>
      )}
    </div>
  );
}
