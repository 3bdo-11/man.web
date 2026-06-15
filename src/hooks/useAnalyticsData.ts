import { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../lib/storageService.ts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { getBehavioralToday, getLogicalWeekRange, safeParseDate } from '../lib/dateUtils.ts';
import { calculateDailyScore } from '../lib/scoring.ts';
import { UserSettings } from '../types.ts';

export type PeriodType = 'weekly' | 'monthly' | 'yearly';

const DATA_LOOKBACK_DAYS = 790;

function getPeriodRange(type: PeriodType, offset: number, firstWeekday: number = 6) {
  const today = getBehavioralToday();
  let start: Date, end: Date, label: string;

  if (type === 'weekly') {
    const { start: ws, end: we } = getLogicalWeekRange(subDays(today, offset * 7), 3, firstWeekday);
    start = ws; end = we;
    const weekNum = Math.ceil((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 604800000);
    label = `Week ${weekNum} / ${format(start, 'MMM')}`;
  } else if (type === 'monthly') {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    start = monthDate;
    end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    label = `${format(start, 'MMM')} / ${format(start, 'yy')}`;
  } else {
    const yearDate = new Date(today.getFullYear() - offset, 0, 1);
    start = yearDate;
    end = new Date(yearDate.getFullYear(), 11, 31);
    label = `${start.getFullYear()}`;
  }

  return { start, end, label };
}

function _buildChartData<T>(
  periodType: PeriodType,
  activeData: any[],
  dayCount: number,
  periodRange: { start: Date },
  getDayValue: (dayData: any) => T,
  getChunkValue: (chunk: any[]) => T,
  getMonthValue: (monthData: any[], month: number) => T,
  firstWeekday: number = 6
): { label: string; value: T }[] {
  if (periodType === 'weekly') {
    const BASE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const days = [...BASE.slice(firstWeekday), ...BASE.slice(0, firstWeekday)];
    return days.map(day => {
      const dayData = activeData.find((d: any) => format(d.date, 'EEE').toUpperCase() === day);
      return { label: day, value: getDayValue(dayData) };
    });
  }
  if (periodType === 'monthly') {
    const chunkSize = Math.max(1, Math.ceil(dayCount / 4));
    return [0, 1, 2, 3].map(i => {
      const chunk = activeData.slice(i * chunkSize, (i + 1) * chunkSize);
      return { label: `Week ${i + 1}`, value: getChunkValue(chunk) };
    });
  }
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
    const mData = activeData.filter((d: any) => d.date.getMonth() === i);
    return { label: format(new Date(periodRange.start.getFullYear(), i, 1), 'MMM'), value: getMonthValue(mData, i) };
  });
}

function getMostTime(relapses: any[]): string {
  const hourCounts: Record<number, number> = {};
  relapses.forEach(r => {
    const ts = safeParseDate(r.timestamp);
    if (!isNaN(ts.getTime())) {
      const h = ts.getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  });
  const sorted = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return '--';
  const h = parseInt(sorted[0][0]);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${period}`;
}

export function useAnalyticsData(settings: UserSettings | null) {
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const firstWeekday = settings?.firstWeekday ?? 6;

  const periodRange = useMemo(() => getPeriodRange(periodType, periodOffset, firstWeekday), [periodType, periodOffset, firstWeekday]);

  const prevPeriodRange = useMemo(() => getPeriodRange(periodType, periodOffset + 1, firstWeekday), [periodType, periodOffset, firstWeekday]);

  const canGoBack = useMemo(() => {
    if (dailyData.length === 0) return true;
    const earliest = dailyData[0].date;
    return earliest < periodRange.start;
  }, [dailyData, periodRange]);

  const canGoForward = periodOffset > 0;
  const onPrev = useCallback(() => setPeriodOffset(o => o + 1), []);
  const onNext = useCallback(() => setPeriodOffset(o => Math.max(0, o - 1)), []);

  const handlePeriodTypeChange = useCallback((type: PeriodType) => {
    setPeriodType(type);
    setPeriodOffset(0);
  }, []);

  const activeData = useMemo(() =>
    dailyData.filter(d => d.date >= periodRange.start && d.date <= periodRange.end),
    [dailyData, periodRange]
  );

  const prevData = useMemo(() =>
    dailyData.filter(d => d.date >= prevPeriodRange.start && d.date <= prevPeriodRange.end),
    [dailyData, prevPeriodRange]
  );

  const isPeriodComplete = useMemo(() => {
    const today = getBehavioralToday();
    return today > periodRange.end;
  }, [periodRange]);

  const summarize = useMemo(() => {
    if (activeData.length === 0) return {
      totalRelapses: 0, prevTotalRelapses: 0, avgRelapse: '0', mostTrigger: '--', mostTime: '--',
      relapseChartData: [] as { label: string; value: number }[],
      avgScore: 0,
      prevAvgScore: 0,
      behaviorPattern: [] as { label: string; score: number }[],
      prayerPercentage: 0, strongestPrayer: '--', weakestPrayer: '--',
      weightAvg: 0, weightDelta: null,
      weightChartData: [] as { label: string; value: number | null }[],
      screenTotal: 0, topApps: [], screenChartData: [] as { label: string; value: number }[],
    };

    const totalRelapses = activeData.reduce((acc, d) => acc + d.relapseCount, 0);
    const prevTotalRelapses = prevData.reduce((acc, d) => acc + d.relapseCount, 0);
    const allRelapses = activeData.flatMap(d => d.relapses || []);

    // Most common time
    const mostTime = getMostTime(allRelapses);

    const dayCount = activeData.length;
    let avgRelapse: string;
    if (periodType === 'weekly') {
      avgRelapse = (totalRelapses / Math.max(1, dayCount)).toFixed(1);
    } else if (periodType === 'monthly') {
      avgRelapse = (totalRelapses / Math.max(1, Math.ceil(dayCount / 7))).toFixed(1);
    } else {
      avgRelapse = (totalRelapses / 12).toFixed(1);
    }

    const avgScore = Math.round(activeData.reduce((acc, d) => acc + d.score, 0) / dayCount);
    const prevDayCount = prevData.length;
    const prevAvgScore = prevDayCount > 0 ? Math.round(prevData.reduce((acc, d) => acc + d.score, 0) / prevDayCount) : 0;

    const behaviorPattern = _buildChartData(periodType, activeData, dayCount, periodRange,
      (d: any) => d ? Math.round(d.score) : 0,
      (chunk: any[]) => chunk.length > 0 ? Math.round(chunk.reduce((s: number, d: any) => s + d.score, 0) / chunk.length) : 0,
      (mData: any[]) => mData.length > 0 ? Math.round(mData.reduce((s: number, d: any) => s + d.score, 0) / mData.length) : 0,
      firstWeekday
    ).map(d => ({ label: d.label, score: d.value }));

    const relapseChartData = _buildChartData(periodType, activeData, dayCount, periodRange,
      (d: any) => d ? d.relapseCount : 0,
      (chunk: any[]) => chunk.reduce((s: number, d: any) => s + d.relapseCount, 0),
      (mData: any[]) => mData.reduce((s: number, d: any) => s + d.relapseCount, 0),
      firstWeekday
    );

    // Prayer stats
    const prayerTypes = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const pStats = prayerTypes.map(type => ({
      type,
      count: activeData.filter(d => d.prayers?.some((p: any) => (p.name || p.type).toLowerCase() === type.toLowerCase())).length
    }));
    const sortedStrong = [...pStats].sort((a, b) => b.count - a.count);
    const strongestPrayer = sortedStrong[0]?.type || '--';
    const weakestPrayer = [...pStats].sort((a, b) => a.count - b.count)[0]?.type || '--';
    const prayedCount = activeData.reduce((acc, d) => acc + (d.prayers?.filter((p: any) => p.status === 'prayed')?.length || 0), 0);
    const totalPossible = dayCount * 5;
    const prayerPercentage = totalPossible > 0 ? Math.round((prayedCount / totalPossible) * 100) : 0;

    // Weight
    const weights = activeData.filter(d => d.weight).map(d => d.weight);
    const weightAvg = weights.length > 0 ? parseFloat((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)) : 0;
    const prevWeights = prevData.filter(d => d.weight).map(d => d.weight);
    let weightDelta: { value: string; isLoss: boolean; isGain: boolean } | null = null;
    if (prevWeights.length > 0 && weightAvg > 0) {
      const prevAvg = prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length;
      const diff = weightAvg - prevAvg;
      weightDelta = { value: Math.abs(diff).toFixed(1), isLoss: diff < 0, isGain: diff > 0 };
    }

    const avgWeight = (arr: number[]) => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
    const weightChartData = periodType === 'weekly'
      ? activeData.filter(d => d.weight != null).map(d => ({ label: format(d.date, 'd'), value: d.weight }))
      : _buildChartData(periodType, activeData, dayCount, periodRange,
          (d: any) => d?.weight != null ? d.weight : null,
          (chunk: any[]) => avgWeight(chunk.filter((d: any) => d.weight != null).map((d: any) => d.weight)),
          (mData: any[]) => avgWeight(mData.filter((d: any) => d.weight != null).map((d: any) => d.weight)),
          firstWeekday
        );

    // Screen time
    const screenTotal = activeData.reduce((acc, d) => acc + (d.screen_minutes || 0), 0);
    const appMap: Record<string, number> = {};
    activeData.forEach(d => {
      (d.app_usages || []).forEach((app: any) => {
        const name = app.appName || app.packageName || 'Unknown';
        appMap[name] = (appMap[name] || 0) + (app.minutes || 0);
      });
    });
    const topApps = Object.entries(appMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([appName, minutes]) => ({ appName, minutes }));

    const screenChartData = _buildChartData(periodType, activeData, dayCount, periodRange,
      (d: any) => d ? d.screen_minutes : 0,
      (chunk: any[]) => chunk.reduce((s: number, d: any) => s + (d.screen_minutes || 0), 0),
      (mData: any[]) => mData.reduce((s: number, d: any) => s + (d.screen_minutes || 0), 0),
      firstWeekday
    );

    return {
      totalRelapses, prevTotalRelapses, avgRelapse, mostTime,
      relapseChartData,
      avgScore, prevAvgScore, behaviorPattern,
      prayerPercentage, strongestPrayer, weakestPrayer,
      weightAvg, weightDelta, weightChartData,
      screenTotal, topApps, screenChartData,
    };
  }, [activeData, prevData, periodType, periodRange, firstWeekday]);

  const fetchAnalytics = useCallback(async (signal: { cancelled: boolean }) => {
    setLoading(true);
    try {
      const today = getBehavioralToday();
      const start = subDays(today, DATA_LOOKBACK_DAYS);
      const end = today;

      const rangeStart = format(start, 'yyyy-MM-dd');
      const rangeEnd = format(end, 'yyyy-MM-dd');
      const logsInRange = await storageService.getAllDaysInRange(rangeStart, rangeEnd);

      if (signal.cancelled) return;

      const logsMap: Record<string, any> = {};
      logsInRange.forEach(log => { logsMap[log.dateStr] = log; });

      const days = eachDayOfInterval({ start, end });

      const richData = days.map((day) => {
        const ds = format(day, 'yyyy-MM-dd');
        const dayData = logsMap[ds] || {};
        const relapses = dayData.relapses || [];
        const prayers = Object.values(dayData.prayers || {});
        const trainings = dayData.trainings || [];
        const weightValue = dayData.weight;

        const scoreResult = calculateDailyScore(
          { date: ds, total_screen_minutes: dayData.total_screen_minutes || 0 } as any,
          prayers as any, trainings as any, relapses as any,
          settings
        );

        return {
          date: day,
          dateStr: ds,
          score: scoreResult.total,
          relapses,
          relapseCount: relapses.length,
          prayers,
          trainings,
          weight: weightValue,
          screen_minutes: dayData.total_screen_minutes || 0,
          app_usages: dayData.app_usages || [],
        };
      });

      if (!signal.cancelled) setDailyData(richData);
    } catch (e) {
      console.error(e);
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchAnalytics(signal);
    return () => { signal.cancelled = true; };
  }, [fetchAnalytics]);

  const hasData = activeData.some(d => d.score !== 0 || d.relapseCount > 0 || d.prayers.length > 0 || d.weight != null);

  return {
    loading, periodType, setPeriodType: handlePeriodTypeChange, periodOffset, setPeriodOffset,
    canGoBack, canGoForward, periodLabel: periodRange.label, onPrev, onNext,
    summarize, isPeriodComplete,
    activeData, dailyData, hasData,
  };
}
