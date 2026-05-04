// Sparkline simples — barras stacked opcionais.
// Sem dependência de recharts (já tem react-vendor pesado).

interface Datum {
  label: string;
  value: number;
  // segments somáveis (stack); se ausente, usa value único
  segments?: Array<{ value: number; className: string }>;
}

interface SparklineProps {
  data: Datum[];
  height?: number; // px
  barClassName?: string; // classe quando data não tem segments
  showValueLabels?: boolean;
}

export default function Sparkline({
  data,
  height = 48,
  barClassName = 'bg-pco-blue/30 hover:bg-pco-blue/50',
  showValueLabels = false,
}: SparklineProps) {
  const max = Math.max(
    1,
    ...data.map((d) => d.segments?.reduce((s, x) => s + x.value, 0) ?? d.value),
  );
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const total = d.segments?.reduce((s, x) => s + x.value, 0) ?? d.value;
        const heightPct = (total / max) * 100;
        return (
          <div
            key={`${d.label}-${i}`}
            title={`${d.label}: ${total}`}
            className="flex-1 flex flex-col-reverse rounded-sm overflow-hidden relative"
            style={{ height: `${heightPct}%`, minHeight: total > 0 ? 2 : 1 }}
          >
            {d.segments ? (
              d.segments.map((seg, si) =>
                seg.value > 0 ? (
                  <div
                    key={si}
                    className={seg.className}
                    style={{ flex: seg.value, minHeight: 2 }}
                  />
                ) : null,
              )
            ) : (
              <div className={`flex-1 ${barClassName}`} />
            )}
            {showValueLabels && total > 0 && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-pco-deep">
                {total}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
