import { useMemo } from 'react';

export interface HeatmapDay {
  date: string;
  count: number;
}

interface Props {
  days: HeatmapDay[];
  summary?: {
    totalLessons: number;
    activeDays: number;
    lastYearLessons: number;
    max: number;
  };
}

const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];
const MONTH_LABELS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

/**
 * Heatmap inspirado no GitHub: 52 colunas (semanas) × 7 linhas (dias da semana,
 * dom-sáb). Recebe array dos últimos 365 dias com count de aulas concluídas.
 *
 * Intensidade da cor por bucket relativo ao max:
 *   0           → bg-surface-mute
 *   count > 0   → 4 níveis de PCO blue
 */
export default function StudyHeatmap({ days, summary }: Props) {
  const { weeks, monthMarks } = useMemo(() => {
    // Agrupa em colunas semanais. A primeira coluna pode ter dias em branco
    // antes do primeiro domingo encontrado.
    const buckets: (HeatmapDay | null)[][] = [];
    let current: (HeatmapDay | null)[] = [];

    for (const d of days) {
      const dt = new Date(d.date + 'T00:00:00Z');
      const dow = dt.getUTCDay(); // 0=Dom .. 6=Sáb
      if (current.length === 0) {
        // Preenche dias em branco até o domingo da semana
        for (let i = 0; i < dow; i++) current.push(null);
      }
      current.push(d);
      if (current.length === 7) {
        buckets.push(current);
        current = [];
      }
    }
    if (current.length > 0) {
      while (current.length < 7) current.push(null);
      buckets.push(current);
    }

    // Marca onde mudam os meses pra rotular
    const marks: { col: number; month: number }[] = [];
    let lastMonth = -1;
    buckets.forEach((week, col) => {
      const firstDay = week.find((d): d is HeatmapDay => d !== null);
      if (firstDay) {
        const m = new Date(firstDay.date + 'T00:00:00Z').getUTCMonth();
        if (m !== lastMonth) {
          marks.push({ col, month: m });
          lastMonth = m;
        }
      }
    });

    return { weeks: buckets, monthMarks: marks };
  }, [days]);

  const max = summary?.max ?? Math.max(0, ...days.map((d) => d.count));

  function bucketColor(count: number): string {
    if (count === 0) return 'bg-surface-mute';
    const ratio = max > 0 ? count / max : 0;
    if (ratio >= 0.75) return 'bg-pco-blue';
    if (ratio >= 0.5) return 'bg-pco-blue/80';
    if (ratio >= 0.25) return 'bg-pco-blue/50';
    return 'bg-pco-blue/30';
  }

  return (
    <div className="space-y-3">
      {summary && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Aulas no último ano" value={summary.lastYearLessons} />
          <Stat label="Dias com estudo" value={summary.activeDays} />
          <Stat
            label="Pico em um dia"
            value={summary.max > 0 ? `${summary.max} aula${summary.max === 1 ? '' : 's'}` : '—'}
          />
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex gap-[2px] mb-1 ml-7">
            {weeks.map((_, col) => {
              const mark = monthMarks.find((m) => m.col === col);
              return (
                <div
                  key={col}
                  className="w-[10px] text-[9px] text-ink-subtle leading-none"
                >
                  {mark ? MONTH_LABELS_PT[mark.month] : ''}
                </div>
              );
            })}
          </div>

          {/* Grid: weekday labels + heatmap rows */}
          <div className="flex gap-1">
            <div className="flex flex-col gap-[2px] text-[9px] text-ink-subtle pr-1 pt-[1px]">
              {WEEKDAY_LABELS.map((l, i) => (
                <div key={i} className="h-[10px] leading-none">
                  {l}
                </div>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {weeks.map((week, col) => (
                <div key={col} className="flex flex-col gap-[2px]">
                  {week.map((d, row) => (
                    <div
                      key={row}
                      title={
                        d
                          ? `${d.date}: ${d.count} aula${d.count === 1 ? '' : 's'}`
                          : ''
                      }
                      className={`w-[10px] h-[10px] rounded-[2px] ${
                        d ? bucketColor(d.count) : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-ink-subtle">
            <span>Menos</span>
            <div className="flex gap-[2px]">
              <div className="w-[10px] h-[10px] rounded-[2px] bg-surface-mute" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-pco-blue/30" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-pco-blue/50" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-pco-blue/80" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-pco-blue" />
            </div>
            <span>Mais</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface-off p-2 text-center">
      <div className="text-[10px] text-ink-subtle uppercase tracking-wide">{label}</div>
      <div className="text-base font-bold text-pco-deep">{value}</div>
    </div>
  );
}
