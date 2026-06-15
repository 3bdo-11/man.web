import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingDown, TrendingUp, Clock, Target, Flame, Moon } from 'lucide-react';
import { cn } from '../../lib/cn.ts';
import { BehavioralPatternBar } from './BehavioralPatternBar.tsx';
import { ScreenTimeChart } from './ScreenTimeChart.tsx';
import { WeightChart } from './WeightChart.tsx';
import { RelapseDeepAnalysis } from './RelapseDeepAnalysis.tsx';
import { ErrorBoundary } from '../layout/ErrorBoundary.tsx';
import type { PeriodType } from '../../hooks/useAnalyticsData.ts';

interface BehaviorItem { label: string; score: number }
interface WeightDelta { value: string; isLoss: boolean; isGain: boolean }
interface TopApp { appName: string; minutes: number }
interface ChartItem { label: string; value: number }
interface WeightChartItem { label: string; value: number | null }

interface SummarizeData {
  totalRelapses: number;
  prevTotalRelapses: number;
  avgRelapse: string;
  mostTime: string;
  relapseChartData: ChartItem[];
  avgScore: number;
  prevAvgScore: number;
  behaviorPattern: BehaviorItem[];
  prayerPercentage: number;
  strongestPrayer: string;
  weakestPrayer: string;
  weightAvg: number;
  weightDelta: WeightDelta | null;
  weightChartData: WeightChartItem[];
  screenTotal: number;
  topApps: TopApp[];
  screenChartData: ChartItem[];
}

interface SummarizeSectionProps {
  data: SummarizeData;
  periodType: PeriodType;
  isPeriodComplete: boolean;
  periodLabel: string;
  activeData?: any[];
  allData?: any[];
  relapseTarget: number;
  firstWeekday: number;
}

function formatTime(totalMinutes: number): string {
  const h = totalMinutes / 60;
  if (h < 24) return `${Math.round(h * 10) / 10}h`;
  const d = Math.floor(h / 24);
  const remH = Math.round(h % 24);
  if (d < 7) return `${d}d ${remH}h`;
  const w = Math.floor(d / 7);
  const remD = d % 7;
  return `${w}w ${remD}d`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function screenAvg(totalMinutes: number, periodType: PeriodType, days: number): number {
  if (periodType === 'weekly') return totalMinutes / Math.max(1, days);
  if (periodType === 'monthly') return totalMinutes / Math.max(1, Math.ceil(days / 7));
  return totalMinutes / 12;
}

function scoreColor(score: number): string {
  return score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
}

function scoreBgColor(score: number): string {
  return score >= 80 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500';
}

export const SummarizeSection = React.memo(function SummarizeSection({ data, periodType, isPeriodComplete, periodLabel, activeData, allData, relapseTarget, firstWeekday }: SummarizeSectionProps) {
  const [relapseExpanded, setRelapseExpanded] = useState(false);
  const [weightExpanded, setWeightExpanded] = useState(false);
  const [screenExpanded, setScreenExpanded] = useState(false);

  const relapseLabel = periodType === 'weekly' ? 'per day' :
    periodType === 'monthly' ? 'per week' : 'per month';

  const displayScore = Math.round(data.avgScore);
  const scorePeriod = periodType === 'weekly' ? 'This Week' :
    periodType === 'monthly' ? 'This Month' : 'This Year';
  const scoreDelta = data.prevAvgScore !== 0 ? displayScore - Math.round(data.prevAvgScore) : null;

  const screenTotalFormatted = data.screenTotal > 0 ? formatTime(data.screenTotal) : '--';
  const screenAvgFormatted = data.screenTotal > 0
    ? formatTime(screenAvg(data.screenTotal, periodType, activeData?.length || 0))
    : '--';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-24"
    >
      {/* ── Score Gauge ── */}
      <div className="card p-6 bg-slate-950 text-white border-0 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="relative flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{scorePeriod}</span>
            {scoreDelta !== null && (
              <span className={cn(
                'flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                scoreDelta > 0 ? 'bg-emerald-500/20 text-emerald-400' :
                scoreDelta < 0 ? 'bg-red-500/20 text-red-400' :
                'bg-slate-500/20 text-slate-400'
              )}>
                {scoreDelta > 0 ? <TrendingUp size={10} /> : scoreDelta < 0 ? <TrendingDown size={10} /> : null}
                {scoreDelta ? (scoreDelta > 0 ? '+' : '') + scoreDelta : '—'}
              </span>
            )}
          </div>
          <div className="relative mb-2">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={scoreBgColor(displayScore)}
                strokeDasharray={`${(displayScore / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-5xl font-black tracking-tighter tabular-nums', scoreColor(displayScore))}>
                {displayScore}
              </span>
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">Average</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Behavioral Patterns ── */}
      {data.behaviorPattern.length > 0 && (
        <BehavioralPatternBar items={data.behaviorPattern} periodType={periodType} />
      )}

      {/* ── KPI Stats Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Relapses */}
        <button
          onClick={() => setRelapseExpanded(!relapseExpanded)}
          className="card p-4 flex flex-col gap-1.5 text-left w-full cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Relapses</span>
            <Flame size={14} className="text-orange-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">{data.avgRelapse}</span>
            <span className="text-[10px] text-slate-400 font-medium">{relapseLabel}</span>
          </div>
          {data.prevTotalRelapses !== data.totalRelapses && (
            <span className={cn(
              'flex items-center gap-1 text-[10px] font-bold',
              data.prevTotalRelapses > data.totalRelapses ? 'text-emerald-600' : 'text-red-500'
            )}>
              {data.prevTotalRelapses > data.totalRelapses ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {data.prevTotalRelapses > data.totalRelapses
                ? `${data.prevTotalRelapses - data.totalRelapses} fewer`
                : `${data.totalRelapses - data.prevTotalRelapses} more`} vs previous
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <Clock size={10} /> Most active: {data.mostTime}
          </span>
        </button>

        {/* Prayer */}
        <div className="card p-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Prayer</span>
            <Moon size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">{data.prayerPercentage}%</span>
            <span className="text-[10px] text-slate-400 font-medium">adherence</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-auto">
            Best: <span className="font-bold text-emerald-600">{data.strongestPrayer}</span>
            {' · '}Weakest: <span className="font-bold text-red-500">{data.weakestPrayer}</span>
          </span>
        </div>

        {/* Screen Time */}
        <button
          onClick={() => setScreenExpanded(!screenExpanded)}
          className="card p-4 flex flex-col gap-1.5 text-left w-full cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Screen Time</span>
            <Clock size={14} className="text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">{screenTotalFormatted}</span>
            <span className="text-[10px] text-slate-400 font-medium">total</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-auto">{screenAvgFormatted} avg{data.topApps.length > 0 ? ` · Top: ${data.topApps[0].appName}` : ''}</span>
        </button>

        {/* Weight */}
        <button
          onClick={() => setWeightExpanded(!weightExpanded)}
          className="card p-4 flex flex-col gap-1.5 text-left w-full cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Weight</span>
            <Target size={14} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              'text-2xl font-black tabular-nums',
              data.weightAvg > 0 ? 'text-slate-900' : 'text-slate-300'
            )}>
              {data.weightAvg > 0 ? data.weightAvg : '—'}
            </span>
            {data.weightAvg > 0 && <span className="text-[10px] text-slate-400 font-medium">kg</span>}
          </div>
          {data.weightDelta && (
            <span className={cn(
              'text-[10px] font-bold mt-auto',
              data.weightDelta.isLoss ? 'text-emerald-600' : data.weightDelta.isGain ? 'text-amber-600' : 'text-slate-400'
            )}>
              {data.weightDelta.isLoss ? '↓' : '↑'} {data.weightDelta.value} kg
            </span>
          )}
        </button>
      </div>

      {/* ── Relapse Deep Analysis ── */}
      <AnimatePresence>
        {relapseExpanded && (
          <motion.div
            id="relapse-deep-analysis"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <ErrorBoundary>
              <RelapseDeepAnalysis
                activeData={activeData || []}
                allData={allData || []}
                periodType={periodType}
                relapseTarget={relapseTarget}
                firstWeekday={firstWeekday}
              />
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {weightExpanded && data.weightChartData.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <WeightChart data={data.weightChartData} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Screen Time Analysis ── */}
      <AnimatePresence>
        {screenExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden space-y-3"
          >
            <div className="card p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">TOTAL</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{screenTotalFormatted}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    {periodType === 'weekly' ? 'DAILY AVG' : periodType === 'monthly' ? 'WEEKLY AVG' : 'MONTHLY AVG'}
                  </p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{screenAvgFormatted}</p>
                </div>
              </div>
              {data.topApps.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">TOP APPS</p>
                  <div className="space-y-1.5">
                    {data.topApps.map((app, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                          <span className="text-xs font-semibold text-slate-700">{app.appName}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 tabular-nums">{formatDuration(app.minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {data.screenChartData.length > 0 && (
              <ScreenTimeChart data={data.screenChartData} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
});
