// Modal de mapeamento de campos CSV após upload.
// Mostra headers detectados + sugestão automática + permite ajustar
// cada coluna pra um campo canônico do AVA.

import { useEffect, useMemo, useState } from 'react';
import { X, ArrowRight, Eye, AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import { previewCsv } from '../data/api';
import { useToast } from './Toast';
import type { CsvPreviewDto, ImportEntityTypeDto } from '../data/api';

interface Props {
  entity: ImportEntityTypeDto;
  file: File;
  onClose: () => void;
  onConfirm: (mapping: Array<{ source: string; target: string | null }>) => void;
}

export default function CsvFieldMapper({ entity, file, onClose, onConfirm }: Props) {
  const [data, setData] = useState<CsvPreviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const toast = useToast();

  useEffect(() => {
    let live = true;
    setLoading(true);
    previewCsv(entity, file)
      .then((p) => {
        if (!live) return;
        setData(p);
        const init: Record<string, string | null> = {};
        for (const m of p.suggestedMapping) init[m.source] = m.target;
        setMapping(init);
      })
      .catch((err) => {
        toast.error('Falha no preview', err instanceof Error ? err.message : 'Erro');
        onClose();
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [entity, file]); // eslint-disable-line react-hooks/exhaustive-deps

  const requiredTargets = useMemo(
    () => (data?.targetFields ?? []).filter((f) => f.required).map((f) => f.name),
    [data],
  );

  const mappedTargets = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean) as string[]),
    [mapping],
  );

  const missingRequired = useMemo(
    () => requiredTargets.filter((t) => !mappedTargets.has(t)),
    [requiredTargets, mappedTargets],
  );

  const matchedCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping],
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b border-pco-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-pco-deep">
              Mapear campos do CSV
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Entidade: <strong>{entity}</strong>
              {data && (
                <>
                  {' · '}
                  {data.totalRows} linha(s) detectadas · {data.headers.length} coluna(s)
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="pco-btn-ghost text-xs">
            <X size={14} />
          </button>
        </div>

        {loading || !data ? (
          <div className="p-10 text-center text-sm text-ink-muted">
            Lendo CSV e sugerindo mapeamento...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            {missingRequired.length > 0 && (
              <div className="rounded-lg border border-pco-orange/40 bg-pco-orange/5 p-3 text-xs text-pco-orange flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Campos obrigatórios sem mapeamento:{' '}
                  <strong>{missingRequired.join(', ')}</strong>
                </span>
              </div>
            )}

            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
                  <Wand2 size={12} className="text-pco-blue" />
                  Mapeamento ({matchedCount}/{data.headers.length} mapeados)
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const auto: Record<string, string | null> = {};
                    for (const m of data.suggestedMapping)
                      auto[m.source] = m.target;
                    setMapping(auto);
                  }}
                  className="pco-btn-ghost text-xs"
                >
                  Restaurar sugestão
                </button>
              </div>
              <div className="space-y-1">
                {data.headers.map((h) => (
                  <div
                    key={h}
                    className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs"
                  >
                    <code className="bg-surface-mute px-2 py-1.5 rounded truncate">
                      {h}
                    </code>
                    <ArrowRight size={11} className="text-ink-subtle" />
                    <select
                      value={mapping[h] ?? ''}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [h]: e.target.value || null,
                        }))
                      }
                      className={`pco-input text-xs ${
                        mapping[h]
                          ? 'border-status-success/40'
                          : 'border-pco-border'
                      }`}
                    >
                      <option value="">— ignorar coluna —</option>
                      {data.targetFields.map((f) => (
                        <option
                          key={f.name}
                          value={f.name}
                          disabled={mappedTargets.has(f.name) && mapping[h] !== f.name}
                        >
                          {f.label} ({f.name}){f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-pco-deep flex items-center gap-2 mb-2">
                <Eye size={12} className="text-pco-blue" />
                Pré-visualização (3 primeiras linhas)
              </h4>
              <div className="overflow-x-auto pco-card p-0">
                <table className="w-full text-xs">
                  <thead className="bg-surface-mute text-ink-muted">
                    <tr>
                      {data.headers.map((h) => (
                        <th key={h} className="text-left px-2 py-1.5 whitespace-nowrap">
                          <div className="font-mono text-xs">{h}</div>
                          {mapping[h] && (
                            <div className="text-status-success text-[9px] flex items-center gap-1 mt-0.5">
                              <CheckCircle2 size={9} />
                              {mapping[h]}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sampleRows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-t border-surface-mute">
                        {data.headers.map((h) => (
                          <td
                            key={h}
                            className="px-2 py-1 text-pco-deep max-w-[200px] truncate"
                          >
                            {row[h] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <div className="px-5 py-3 border-t border-pco-border flex items-center justify-between gap-2">
          <span className="text-xs text-ink-muted">
            {data && (
              <>
                {Object.values(mapping).filter(Boolean).length} de{' '}
                {data.headers.length} colunas mapeadas
              </>
            )}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="pco-btn-ghost text-xs">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!data) return;
                if (missingRequired.length > 0) {
                  if (
                    !confirm(
                      `Ainda faltam campos obrigatórios: ${missingRequired.join(', ')}.\n\nProsseguir mesmo assim?`,
                    )
                  ) {
                    return;
                  }
                }
                onConfirm(
                  Object.entries(mapping).map(([source, target]) => ({
                    source,
                    target,
                  })),
                );
              }}
              disabled={!data}
              className="pco-btn-primary text-xs"
            >
              <CheckCircle2 size={11} strokeWidth={2} />
              Confirmar mapeamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
