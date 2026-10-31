import type * as React from 'react';

interface Item {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface Props {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  format?: (value: number, name: string) => string;
}

export const ChartTip: React.FC<Props> = ({ active, payload, label, format }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[150px] rounded-xl border border-line bg-panel px-3 py-2.5 text-xs shadow-pop">
      {label !== undefined && <p className="mb-1.5 font-bold text-ink">{label}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          const name = String(p.name ?? p.dataKey ?? '');
          const num = typeof p.value === 'number' ? p.value : Number(p.value ?? 0);
          return (
            <li key={`${name}-${i}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-mute">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
                {name}
              </span>
              <span className="tnum font-semibold text-ink">{format ? format(num, name) : num}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
