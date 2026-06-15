import React from 'react';
import { HistoryChart } from './HistoryChart.tsx';
import type { HistoryGrid as HistoryGridData } from './relapsePresenter.ts';

interface HistoryGridProps {
  grid: HistoryGridData;
  relapseTarget: number;
  firstWeekday: number;
}

export const HistoryGrid = React.memo(function HistoryGrid({ grid, relapseTarget, firstWeekday }: HistoryGridProps) {
  const weeks = grid.weeks;
  if (weeks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-header">History</h3>
        <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> ≤{relapseTarget}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> &gt;{relapseTarget}
          </span>
        </div>
      </div>
      <div className="card overflow-x-auto py-4 px-5">
        <HistoryChart weeks={weeks} relapseTarget={relapseTarget} firstWeekday={firstWeekday} />
      </div>
    </section>
  );
});
