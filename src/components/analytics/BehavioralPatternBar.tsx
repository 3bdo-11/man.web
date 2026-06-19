import React from 'react';
import { cn } from '../../lib/cn.ts';
import type { PeriodType } from '../../hooks/useAnalyticsData.ts';

interface BehaviorItem {
  label: string;
  score: number;
}

interface BehavioralPatternBarProps {
  items: BehaviorItem[];
  periodType: PeriodType;
}

export const BehavioralPatternBar = React.memo(function BehavioralPatternBar({ items, periodType }: BehavioralPatternBarProps) {
  const periodLabel = periodType === 'weekly' ? 'DAILY PATTERNS' :
    periodType === 'monthly' ? 'WEEKLY PATTERNS' : 'MONTHLY PATTERNS';

  const levelLabel = (score: number) =>
    score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';

  return (
    <section className="space-y-4">
      <h2 className="section-header">{periodLabel}</h2>
      <div className="card p-6">
        <div className={cn('gap-2', items.length >= 12 ? 'grid grid-cols-4' : 'flex')}>
          {items.map((item, i) => {
            const color = item.score >= 75 ? 'bg-emerald-500' :
              item.score >= 50 ? 'bg-amber-400' : 'bg-red-500';
            const isSmall = items.length >= 12;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <div
                  role="progressbar"
                  aria-valuenow={item.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.label}: ${item.score} (${levelLabel(item.score)})`}
                  className={cn(
                    'w-full rounded-xl flex items-center justify-center font-bold shadow-sm border border-slate-100',
                    isSmall ? 'h-12 text-xs' : 'h-16 text-lg',
                    color
                  )}
                >
                  <span className="text-white text-[10px] font-bold">{item.score}</span>
                </div>
                <span className={cn(
                  'font-semibold text-slate-400 uppercase tracking-wider text-center truncate w-full',
                  isSmall ? 'text-[8px]' : 'text-[9px]'
                )}>{item.label}</span>

              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
