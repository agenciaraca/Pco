// Cabeçalho de coluna clicável com sort asc/desc para tabelas admin.
// Pareado com o hook useTableSort em hooks/useTableSort.ts.

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface SortableThProps {
  /** Identificador único da coluna (mesma key passada ao useTableSort) */
  field: string;
  /** Coluna atualmente ordenada (vem do hook) */
  current: string | null;
  /** Direção atual: 'asc' | 'desc' */
  direction: 'asc' | 'desc';
  /** Callback ao clicar — alterna direção se já está nesta coluna */
  onSort: (field: string) => void;
  /** Conteúdo do header (label) */
  children: React.ReactNode;
  /** classNames extras pro <th> */
  className?: string;
  /** Alinhamento ('left' default | 'right' | 'center') — afeta layout do label+ícone */
  align?: 'left' | 'right' | 'center';
}

export default function SortableTh({
  field,
  current,
  direction,
  onSort,
  children,
  className = '',
  align = 'left',
}: SortableThProps) {
  const isActive = current === field;
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-3 ${textAlign} font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 ${justify} w-full hover:text-pco-deep transition-colors ${isActive ? 'text-pco-deep' : ''}`}
        aria-label={`Ordenar por ${typeof children === 'string' ? children : field}`}
      >
        <span>{children}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ChevronUp size={11} strokeWidth={2.5} className="text-pco-blue" />
          ) : (
            <ChevronDown size={11} strokeWidth={2.5} className="text-pco-blue" />
          )
        ) : (
          <ChevronsUpDown size={11} strokeWidth={1.5} className="text-ink-subtle opacity-60" />
        )}
      </button>
    </th>
  );
}
