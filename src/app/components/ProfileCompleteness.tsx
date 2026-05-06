import { CheckCircle2, Circle } from 'lucide-react';

export interface ProfileItem {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
}

interface Props {
  items: ProfileItem[];
}

/**
 * Card mostrando o quão completo está o perfil do aluno, com lista
 * de items + barra de progresso. Cada item tem flag `done` e um
 * hint opcional que aparece como texto pequeno abaixo do label.
 */
export default function ProfileCompleteness({ items }: Props) {
  const total = items.length;
  const completed = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <section
      className="pco-card p-5 space-y-4"
      aria-label="Quão completo está seu perfil"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-pco-deep">
            Seu perfil
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {completed === total
              ? 'Tudo preenchido — bom trabalho!'
              : `${completed} de ${total} items completos`}
          </p>
        </div>
        <div className="text-2xl font-bold text-pco-deep tabular-nums">
          {pct}%
        </div>
      </header>

      <div className="h-2 rounded-full bg-surface-mute overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct === 100
              ? 'bg-status-success'
              : 'bg-gradient-to-r from-pco-blue to-pco-cyan'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5">
            {item.done ? (
              <CheckCircle2
                size={16}
                className="text-status-success shrink-0 mt-0.5"
                strokeWidth={2}
              />
            ) : (
              <Circle
                size={16}
                className="text-ink-subtle shrink-0 mt-0.5"
                strokeWidth={2}
              />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm ${
                  item.done ? 'text-ink-muted line-through' : 'text-ink-strong'
                }`}
              >
                {item.label}
              </div>
              {item.hint && !item.done && (
                <div className="text-[11px] text-ink-subtle mt-0.5">{item.hint}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
