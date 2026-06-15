import React, { useMemo } from 'react';
import { buildRelapseState, computeHistoryGrid, computeFrequencyCells, computeWeekdayTotals } from './relapsePresenter.ts';
import { TargetCard } from './TargetCard.tsx';
import { HistoryGrid } from './HistoryGrid.tsx';
import { StreakBars } from './StreakBars.tsx';
import { FrequencyGrid } from './FrequencyGrid.tsx';
import type { PeriodType } from '../../hooks/useAnalyticsData.ts';

interface RelapseDeepAnalysisProps {
  activeData: any[];
  allData?: any[];
  periodType: PeriodType;
  relapseTarget: number;
  firstWeekday: number;
}

export const RelapseDeepAnalysis = React.memo(function RelapseDeepAnalysis({
  activeData = [], allData = [], periodType, relapseTarget, firstWeekday,
}: RelapseDeepAnalysisProps) {
  const state = useMemo(() => buildRelapseState(activeData, relapseTarget, firstWeekday), [activeData, relapseTarget, firstWeekday]);

  const fullHistoryGrid = useMemo(() => computeHistoryGrid(allData.length > 0 ? allData : activeData, firstWeekday), [allData, activeData, firstWeekday]);

  const allDayData = allData.length > 0 ? allData : activeData;
  const allFrequencyCells = useMemo(() => computeFrequencyCells(allDayData, firstWeekday), [allDayData, firstWeekday]);
  const allWeekdayTotals = useMemo(() => computeWeekdayTotals(allDayData, firstWeekday), [allDayData, firstWeekday]);
  const allMaxWeekday = Math.max(...allWeekdayTotals, 1);
  const allTotalWeekday = allWeekdayTotals.reduce((a, b) => a + b, 0);
  const satIdx = (6 - firstWeekday + 7) % 7;
  const sunIdx = (0 - firstWeekday + 7) % 7;
  const allWeekendTotal = allWeekdayTotals[satIdx] + allWeekdayTotals[sunIdx];
  const allWeekendPct = allTotalWeekday > 0 ? Math.round((allWeekendTotal / allTotalWeekday) * 100) : 0;

  if (state.totalDays === 0) {
    return (
      <div className="space-y-8 pt-6 border-t border-slate-100">
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-slate-400">No daily data in this period</p>
          <p className="text-xs text-slate-300 mt-1">Nothing to analyze yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-6 border-t border-slate-100">
      <TargetCard
        bars={state.targetBars}
        targetPerDay={relapseTarget}
        totalRelapses={state.totalRelapses}
        totalDays={state.totalDays}
        periodType={periodType}
      />

      <HistoryGrid grid={fullHistoryGrid} relapseTarget={relapseTarget} firstWeekday={firstWeekday} />

      <StreakBars
        currentStreak={state.currentStreak}
        bestStreak={state.bestStreak}
        isActive={state.isActive}
        topStreaks={state.topStreaks}
      />

      <FrequencyGrid
        cells={allFrequencyCells}
        weekdayTotals={allWeekdayTotals}
        maxWeekday={allMaxWeekday}
        weekendPct={allWeekendPct}
        totalDays={allDayData.length}
        firstWeekday={firstWeekday}
      />
    </div>
  );
});
