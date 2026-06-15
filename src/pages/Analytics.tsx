import { BarChart2, Target } from 'lucide-react';
import { useAnalyticsData } from '../hooks/useAnalyticsData.ts';
import { PeriodNavigation } from '../components/analytics/PeriodNavigation.tsx';
import { SummarizeSection } from '../components/analytics/SummarizeSection.tsx';
import { UserSettings } from '../types.ts';
import { Skeleton } from '../components/ui/Skeleton.tsx';

export default function Analytics({ settings }: Readonly<{ settings: UserSettings | null }>) {
  const {
    loading, periodType, setPeriodType, periodOffset,
    canGoBack, canGoForward, periodLabel, onPrev, onNext,
      summarize, isPeriodComplete, activeData, dailyData,
      hasData,
  } = useAnalyticsData(settings);

  if (loading) return (
    <div className="p-grid gap-grid mx-auto pb-40 w-full max-w-app">
      <div className="space-y-4">
        <div className="flex bg-slate-100/50 p-1 rounded-2xl w-full border border-slate-200/50">
          {[1, 2, 3].map(i => <Skeleton key={i} className="flex-1 h-8 rounded-xl" />)}
        </div>
        <div className="flex items-center justify-between bg-white p-3 rounded-3xl border border-slate-100">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="w-12 h-12 rounded-2xl" />
        </div>
      </div>
      <div className="card p-8 bg-slate-950 flex flex-col items-center gap-3">
        <Skeleton className="w-[120px] h-[120px] rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-grid gap-grid mx-auto pb-40 w-full max-w-app">
      <PeriodNavigation
        periodType={periodType}
        periodLabel={periodLabel}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onTypeChange={setPeriodType}
        onPrev={onPrev}
        onNext={onNext}
      />
      {hasData ? (
        <SummarizeSection
          data={summarize}
          periodType={periodType}
          isPeriodComplete={isPeriodComplete}
          periodLabel={periodLabel}
          activeData={activeData}
          allData={dailyData}
          relapseTarget={settings?.relapse_daily_target || 2}
          firstWeekday={settings?.firstWeekday ?? 6}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center">
            <BarChart2 size={28} className="text-slate-300" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">No data yet</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-2xl">
            <Target size={14} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400">Go to Daily tab to log your first entry</span>
          </div>
        </div>
      )}
    </div>
  );
}
