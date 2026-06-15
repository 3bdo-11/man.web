import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn.ts';
import { getDayLabels } from './relapsePresenter.ts';
import type { HistoryDay } from './relapsePresenter.ts';

interface HistoryChartProps {
  weeks: { weekStart: Date; days: (HistoryDay | null)[] }[];
  relapseTarget: number;
  firstWeekday: number;
}

const WEEKEND_LABELS = new Set(['Su', 'Sa']);

export const HistoryChart = React.memo(function HistoryChart({ weeks, relapseTarget, firstWeekday }: HistoryChartProps) {
  const navigate = useNavigate();
  const dayLabels = getDayLabels(firstWeekday);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const todayCol = weeks.findIndex(w =>
      w.days.some(d => d?.dateStr === todayDateStr)
    );
    if (todayCol < 0 || !scrollRef.current) return;
    const col = scrollRef.current.querySelector<HTMLElement>(
      `[data-col-index="${todayCol}"]`
    );
    if (!col) return;
    const container = scrollRef.current;
    const scrollLeft = col.offsetLeft - container.clientWidth / 2 + col.offsetWidth / 2;
    container.scrollLeft = Math.max(0, scrollLeft);
  }, [weeks, todayDateStr]);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5">
        {/* Month header row */}
        <div className="flex items-center gap-0.5 mb-1">
          <div className="w-7 flex-shrink-0 sticky left-0 z-10 bg-[var(--brand-card)]" />
          {weeks.map((week, colIdx) => {
            const prevMonth = colIdx > 0 ? format(weeks[colIdx - 1].weekStart, 'MMM') : null;
            const curMonth = format(week.weekStart, 'MMM');
            const showMonth = colIdx === 0 || prevMonth !== curMonth;
            return (
              <div key={colIdx} data-col-index={colIdx} className="w-[36px] flex items-center justify-center">
                {showMonth && (
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    {curMonth}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Day rows */}
        {dayLabels.map((label, rowIdx) => (
          <div key={label} className="flex items-center gap-0.5">
            <div className="w-7 h-[36px] flex items-center justify-center flex-shrink-0 sticky left-0 z-10 bg-[var(--brand-card)]">
              <span className={cn(
                'text-[9px] font-bold',
                WEEKEND_LABELS.has(label) ? 'text-red-400' : 'text-slate-400'
              )}>
                {label[0]}
              </span>
            </div>
            {weeks.map((week, colIdx) => {
              const day = week.days[rowIdx];
              if (!day) {
                return (
                  <div key={colIdx} className="w-[36px] h-[36px] rounded-lg flex items-center justify-center" />
                );
              }
              const withinTarget = day.relapseCount <= relapseTarget;
              const isToday = day.dateStr === todayDateStr;
              const intensity = withinTarget
                ? day.relapseCount === 0 ? 'bg-emerald-400' : 'bg-emerald-300'
                : day.relapseCount <= relapseTarget * 2 ? 'bg-rose-300' : 'bg-rose-500';

              return (
                <button
                  key={colIdx}
                  onClick={() => navigate('/?date=' + encodeURIComponent(day.dateStr))}
                  className={cn(
                    'w-[36px] h-[36px] rounded-lg transition-all cursor-pointer flex items-center justify-center',
                    intensity,
                    'hover:ring-2 hover:ring-slate-400/40 hover:scale-105',
                    isToday && 'ring-2 ring-slate-900'
                  )}
                  aria-label={`${format(day.date, 'MMMM d, yyyy')}: ${day.relapseCount} relapse${day.relapseCount !== 1 ? 's' : ''}, ${withinTarget ? 'within' : 'over'} target`}
                >
                  <span className="text-[10px] font-bold leading-none text-white">
                    {format(day.date, 'd')}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
