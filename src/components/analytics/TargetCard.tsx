import React, { useMemo } from 'react';
import { cn } from '../../lib/cn.ts';
import type { PeriodType } from '../../hooks/useAnalyticsData.ts';

interface TargetBar {
  label: string;
  current: number;
  target: number;
  skipped: number;
}

interface TargetCardProps {
  bars: TargetBar[];
  targetPerDay: number;
  totalRelapses: number;
  totalDays: number;
  periodType: PeriodType;
}

export const TargetCard = React.memo(function TargetCard({ bars, targetPerDay, totalRelapses, totalDays, periodType }: TargetCardProps) {
  const visibleBars = useMemo(() => {
    if (periodType === 'weekly') return bars.slice(0, 2);
    if (periodType === 'monthly') return bars.slice(2, 3);
    return bars.filter(b => b.label === 'Year');
  }, [bars, periodType]);

  if (visibleBars.length === 0) return null;

  const totalTarget = visibleBars.reduce((s, b) => s + b.target, 0);

  return (
    <section className="space-y-4">
      <h3 className="section-header">
        TARGET — <span className="text-slate-500 font-normal normal-case tracking-normal">Am I staying within my limit?</span>
      </h3>
      <div className="card p-6 space-y-4 bg-white border-slate-100 shadow-sm">
        {visibleBars.map(bar => {
          const pct = bar.target > 0 ? Math.min(bar.current / bar.target, 1) * 100 : 0;
          const over = bar.current > bar.target;
          const color = bar.current === 0 ? 'bg-emerald-500' : over ? 'bg-red-500' : 'bg-amber-400';

          return (
            <div key={bar.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{bar.label}</span>
                <span className={cn('font-bold tabular-nums', over ? 'text-red-500' : 'text-slate-500')}>
                  {bar.current} / {bar.target}
                </span>
              </div>
              <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', color)}
                  style={{ width: `${pct}%` }}
                />
                {pct > 15 && (
                  <span className="absolute inset-0 flex items-center px-2 text-[9px] font-bold text-white drop-shadow-sm">
                    {bar.current}
                  </span>
                )}
                {!over && pct < 100 && (
                  <span className="absolute inset-0 flex items-center justify-end px-2 text-[9px] font-bold text-slate-400">
                    {bar.target - bar.current} left
                  </span>
                )}
                {over && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-500">
                    +{bar.current - bar.target}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
          Target: ≤{targetPerDay} relapse{targetPerDay !== 1 ? 's' : ''} per day.
          {totalRelapses <= totalTarget
            ? ` You're within target for this period.`
            : ` You've exceeded target for this period.`}
        </p>
      </div>
    </section>
  );
});
