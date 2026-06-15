import React, { useMemo } from 'react';
import { getDayLabels } from './relapsePresenter.ts';
import type { FrequencyCell } from './relapsePresenter.ts';

interface FrequencyGridProps {
  cells: FrequencyCell[];
  weekdayTotals: number[];
  maxWeekday: number;
  weekendPct: number;
  totalDays: number;
  firstWeekday: number;
}

const intensityColor = (scale: number) => {
  if (scale === 0) return 'bg-[var(--brand-border)]';
  if (scale < 0.25) return 'bg-rose-200';
  if (scale < 0.5) return 'bg-rose-300';
  if (scale < 0.75) return 'bg-rose-400';
  return 'bg-rose-500';
};

export const FrequencyGrid = React.memo(function FrequencyGrid({
  cells, weekdayTotals, maxWeekday, weekendPct, totalDays, firstWeekday,
}: FrequencyGridProps) {
  const months = useMemo(() => {
    const mSet = new Set<string>();
    cells.forEach(c => mSet.add(c.monthLabel));
    return Array.from(mSet);
  }, [cells]);

  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    cells.forEach(c => map.set(c.monthLabel + '|' + c.weekday, c.count));
    return map;
  }, [cells]);

  const dayLabels = getDayLabels(firstWeekday);

  const weekdayBars = useMemo(() => {
    const maxVal = Math.max(...weekdayTotals, 1);
    return dayLabels.map((label, i) => ({
      label,
      value: weekdayTotals[i],
      pct: (weekdayTotals[i] / maxVal) * 100,
    }));
  }, [weekdayTotals, dayLabels]);

  if (months.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="section-header">
        FREQUENCY — <span className="text-[var(--brand-muted)] font-normal normal-case tracking-normal">When do relapses happen most?</span>
      </h3>
      <div className="card p-5 space-y-5">
        {/* Weekly Pattern Bars */}
        <div>
          <p className="text-[9px] font-semibold text-[var(--brand-muted)] uppercase tracking-widest mb-3">By Day of Week</p>
          <div className="space-y-2">
            {weekdayBars.map(({ label, value, pct }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-6 text-[10px] font-bold text-[var(--brand-muted)] text-right flex-shrink-0">{label}</span>
                <div className="flex-1 h-5 rounded-full bg-[var(--brand-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-300 to-rose-500 transition-all"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                <span className="w-5 text-[10px] font-bold text-[var(--brand-text)] tabular-nums text-right flex-shrink-0">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Heatmap Grid */}
        <div>
          <p className="text-[9px] font-semibold text-[var(--brand-muted)] uppercase tracking-widest mb-3">By Month</p>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1">
              {/* Month headers */}
              <div className="flex items-center gap-1 pl-8">
                {months.map(m => (
                  <div key={m} className="w-[32px] flex items-center justify-center">
                    <span className="text-[7px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">{m}</span>
                  </div>
                ))}
              </div>

              {/* Day rows */}
              {dayLabels.map((label, rowIdx) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-7 pr-1 flex-shrink-0 text-right">
                    <span className="text-[9px] font-bold text-[var(--brand-muted)]">{label}</span>
                  </div>
                  {months.map(m => {
                    const count = cellMap.get(m + '|' + rowIdx) || 0;
                    const scale = maxWeekday > 0 ? count / maxWeekday : 0;
                    return (
                      <div
                        key={m}
                        className="w-[32px] h-[32px] rounded-md flex items-center justify-center transition-colors"
                        style={{ width: 32, height: 32 }}
                      >
                        <div
                          className={`w-full h-full rounded-md flex items-center justify-center ${intensityColor(scale)}`}
                          title={`${label}: ${count} relapse${count !== 1 ? 's' : ''}`}
                        >
                          {count > 0 && (
                            <span className="text-[9px] font-bold text-white drop-shadow-sm">{count}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend + Insight */}
        <div className="border-t border-[var(--brand-border)] pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">Low</span>
            <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-rose-200 via-rose-300 to-rose-500" />
            <span className="text-[8px] font-semibold text-[var(--brand-muted)] uppercase tracking-wider">High</span>
          </div>
          {totalDays > 0 && (
            <p className="text-[10px] text-[var(--brand-muted)] leading-relaxed">
              <strong className="text-[var(--brand-text)]">{weekendPct}%</strong> of relapses happen on weekends
              {weekendPct > 50 ? ' — your most vulnerable time.' : ', but most happen on weekdays.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
});
