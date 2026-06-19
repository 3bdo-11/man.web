import React from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/cn.ts';
import type { StreakInfo } from './relapsePresenter.ts';

interface StreakBarsProps {
  currentStreak: number;
  bestStreak: number;
  isActive: boolean;
  topStreaks: StreakInfo[];
}

export const StreakBars = React.memo(function StreakBars({
  currentStreak, bestStreak, isActive, topStreaks = [],
}: StreakBarsProps) {
  const maxLen = Math.max(bestStreak, 1);
  const display = topStreaks.slice(0, 3);

  return (
    <section className="space-y-4">
      <h3 className="section-header">
        STREAK — <span className="text-slate-500 font-normal normal-case tracking-normal">Longest clean streaks</span>
      </h3>
      <div className="card p-6 space-y-5 bg-white border-slate-100 shadow-sm">
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="text-center">
            <p className={cn('text-4xl font-black tabular-nums tracking-tight', isActive ? 'text-orange-500' : 'text-slate-400')}>
              {currentStreak}
            </p>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                {isActive ? 'CURRENT' : 'BROKEN'}
              </p>
          </div>
          <div className="text-center pl-6 border-l border-slate-200">
            <p className="text-3xl font-black tabular-nums text-emerald-500 tracking-tight">{bestStreak}</p>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1">BEST</p>
          </div>
        </div>

        {display.length > 0 && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Top Streaks</p>
            {display.map((s, i) => {
              const pct = (s.length / maxLen) * 100;
              const barColor = pct >= 100 ? 'bg-emerald-500' :
                pct >= 80 ? 'bg-emerald-400' :
                pct >= 50 ? 'bg-emerald-300' : 'bg-slate-300';
              const barWidth = `${Math.max(pct, 8)}%`;
              const showDates = pct < 60;

              return (
                <div key={format(s.start, 'yyyy-MM-dd') + '-' + s.length} className="flex items-center gap-2 h-6">
                  <div className="flex-1 h-5 flex items-center">
                    <div
                      className={cn('h-full rounded-full flex items-center justify-center transition-all min-w-[2rem]', barColor)}
                      style={{ width: barWidth }}
                    >
                      <span className="text-[9px] font-bold text-white drop-shadow-sm px-1">
                        {s.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                      {format(s.start, 'MMM d')}
                    </span>
                    <span className="text-[9px] text-slate-300">→</span>
                    <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                      {format(s.end, 'MMM d')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {display.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-3 border-t border-slate-100">
            No clean streaks yet. Start today.
          </p>
        )}
      </div>
    </section>
  );
});
