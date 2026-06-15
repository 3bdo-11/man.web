import { startOfWeek, endOfWeek, addDays, format, subMonths, differenceInDays, getDay, isBefore, startOfDay } from 'date-fns';

export interface DayEntry {
  date: Date;
  dateStr: string;
  value: number;       // Loop-style: 2=YES_MANUAL(clean), 0=NO(relapsed)
  relapseCount: number;
  score: number;
}

export interface StreakInfo {
  length: number;
  start: Date;
  end: Date;
  isCurrent: boolean;
}

export interface TargetBar {
  label: string;
  current: number;
  target: number;
  skipped: number;
}

export interface ScorePoint {
  date: string;
  value: number;
}

export interface BarEntry {
  label: string;
  value: number;
}

export interface HistoryDay {
  date: Date;
  dateStr: string;
  value: number;
  relapseCount: number;
  hasNotes: boolean;
}

export interface HistoryGrid {
  weeks: { weekStart: Date; days: (HistoryDay | null)[] }[];
}

export interface FrequencyCell {
  month: Date;
  monthLabel: string;
  weekday: number;
  count: number;
}

export interface RelapseState {
  totalDays: number;
  totalRelapses: number;
  totalClean: number;
  avgScore: number;
  todayScore: number;
  scoreChange1m: number;
  scoreChange1y: number;
  currentStreak: number;
  bestStreak: number;
  isActive: boolean;
  topStreaks: StreakInfo[];
  targetBars: TargetBar[];
  scoreData: ScorePoint[];
  barData: BarEntry[];
  historyGrid: HistoryGrid;
  frequencyCells: FrequencyCell[];
  weekdayTotals: number[];
  maxWeekday: number;
  weekendPct: number;
}

export function getDayLabels(firstWeekday: number): string[] {
  const BASE = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return [...BASE.slice(firstWeekday), ...BASE.slice(0, firstWeekday)];
}

function isCleanDay(d: any): boolean {
  return (d.relapseCount || 0) === 0;
}

export function computeStreaks(days: any[]): {
  currentStreak: number; bestStreak: number; isActive: boolean; topStreaks: StreakInfo[];
} {
  const sorted = [...days].filter(isCleanDay).map(d => d.date).sort((a: Date, b: Date) => a.getTime() - b.getTime());
  if (sorted.length === 0) return { currentStreak: 0, bestStreak: 0, isActive: false, topStreaks: [] };

  const lastDate = sorted[sorted.length - 1];

  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const expected = addDays(sorted[i], 1);
    if (i === sorted.length - 1 || sorted[i + 1].getTime() === expected.getTime()) currentStreak++;
    else break;
  }
  const isActive = currentStreak > 0 && sorted[sorted.length - 1] >= startOfDay(addDays(new Date(), -1));

  const streaks: StreakInfo[] = [];
  let streakStart: Date = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const expected = addDays(sorted[i - 1], 1);
    if (sorted[i].getTime() !== expected.getTime()) {
      streaks.push({ length: differenceInDays(sorted[i - 1], streakStart) + 1, start: streakStart, end: sorted[i - 1], isCurrent: false });
      streakStart = sorted[i];
    }
  }
  streaks.push({ length: differenceInDays(lastDate, streakStart) + 1, start: streakStart, end: lastDate, isCurrent: isActive });

  const bestStreak = streaks.length > 0 ? Math.max(...streaks.map(s => s.length)) : currentStreak;
  const topStreaks = streaks.sort((a, b) => b.length - a.length).slice(0, 10);

  return { currentStreak, bestStreak, isActive, topStreaks };
}

export function computeTargetBars(
  activeData: any[],
  totalRelapses: number,
  totalDays: number,
  targetPerDay: number
): TargetBar[] {
  const today = activeData.length > 0 ? activeData[activeData.length - 1] : null;
  const todayCount = today ? today.relapseCount : 0;

  const weekData = activeData.slice(-7);
  const weekCount = weekData.reduce((s, d) => s + d.relapseCount, 0);

  const lastDay = activeData[activeData.length - 1]?.date;
  const daysInMonth = lastDay ? new Date(lastDay.getFullYear(), lastDay.getMonth() + 1, 0).getDate() : 30;
  const monthTarget = daysInMonth * targetPerDay;

  const skipped = activeData.filter(d => !isCleanDay(d)).length;

  const now = new Date();
  const quarterCutoff = subMonths(now, 3);
  const yearCutoff = subMonths(now, 12);
  const quarterData = activeData.filter(d => d.date >= quarterCutoff);
  const yearData = activeData.filter(d => d.date >= yearCutoff);
  const quarterRelapses = quarterData.reduce((s, d) => s + (d.relapseCount || 0), 0);
  const yearRelapses = yearData.reduce((s, d) => s + (d.relapseCount || 0), 0);

  return [
    { label: 'Today', current: todayCount, target: targetPerDay, skipped: 0 },
    { label: 'Week', current: weekCount, target: 7 * targetPerDay, skipped: weekData.filter(d => !isCleanDay(d)).length },
    { label: 'Month', current: totalRelapses, target: monthTarget, skipped },
    { label: 'Quarter', current: quarterRelapses, target: 90 * targetPerDay, skipped: quarterData.filter(d => !isCleanDay(d)).length },
    { label: 'Year', current: yearRelapses, target: 365 * targetPerDay, skipped: yearData.filter(d => !isCleanDay(d)).length },
  ];
}

export function computeHistoryGrid(activeData: any[], firstWeekday: number = 6): HistoryGrid {
  if (!activeData || activeData.length === 0) return { weeks: [] };

  const dates = activeData.map(d => d.date).sort((a: Date, b: Date) => a.getTime() - b.getTime());
  const first = dates[0];
  const last = dates[dates.length - 1];

  const start = startOfWeek(first, { weekStartsOn: firstWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const end = endOfWeek(last, { weekStartsOn: firstWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

  const dayMap = new Map<string, HistoryDay>();
  activeData.forEach(d => {
    dayMap.set(d.dateStr, {
      date: d.date, dateStr: d.dateStr,
      value: isCleanDay(d) ? 2 : 0,
      relapseCount: d.relapseCount || 0,
      hasNotes: (d.relapses || []).length > 0,
    });
  });

  const weeks: { weekStart: Date; days: (HistoryDay | null)[] }[] = [];
  let cursor = start;
  while (isBefore(cursor, end) || cursor.getTime() === end.getTime()) {
    const weekDays: (HistoryDay | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(cursor, i);
      const ds = format(day, 'yyyy-MM-dd');
      weekDays.push(dayMap.get(ds) || null);
    }
    weeks.push({ weekStart: cursor, days: weekDays });
    cursor = addDays(cursor, 7);
  }

  return { weeks };
}

export function computeFrequencyCells(activeData: any[], firstWeekday: number = 6): FrequencyCell[] {
  const monthMap = new Map<string, number[]>();
  activeData.forEach(d => {
    const count = d.relapseCount || 0;
    if (count === 0) return;
    const mKey = format(d.date, 'yyyy-MM');
    if (!monthMap.has(mKey)) monthMap.set(mKey, [0, 0, 0, 0, 0, 0, 0]);
    const dow = getDay(d.date);
    const idx = (dow - firstWeekday + 7) % 7;
    monthMap.get(mKey)![idx] += count;
  });

  return Array.from(monthMap.entries()).flatMap(([mKey, counts]) => {
    const month = new Date(mKey + '-01');
    return counts.map((count, weekday) => ({
      month, monthLabel: format(month, 'MMM yy'),
      weekday, count,
    }));
  });
}

export function computeWeekdayTotals(activeData: any[], firstWeekday: number = 6): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const day of activeData) {
    const dow = getDay(day.date);
    const idx = (dow - firstWeekday + 7) % 7;
    counts[idx] += day.relapseCount || 0;
  }
  return counts;
}

export function computeScoreChange(activeData: any[], prevMonths: number): number {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - prevMonths, now.getDate());
  const recent = activeData.filter(d => d.date >= cutoff);
  const older = activeData.filter(d => d.date < cutoff && d.date >= subMonths(now, prevMonths * 2));
  const recentAvg = recent.length > 0 ? recent.reduce((s, d) => s + d.score, 0) / recent.length : 0;
  const olderAvg = older.length > 0 ? older.reduce((s, d) => s + d.score, 0) / older.length : 0;
  if (olderAvg === 0) return 0;
  return Math.round(((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100);
}

export function computeScoreData(activeData: any[]): ScorePoint[] {
  return activeData
    .filter(d => d.score !== undefined)
    .map(d => ({ date: format(d.date, 'MMM d'), value: d.score }));
}

export function computeBarData(activeData: any[], bucketSize: 'day' | 'week' | 'month'): BarEntry[] {
  if (bucketSize === 'week') {
    const chunkSize = Math.max(1, Math.ceil(activeData.length / 4));
    return [0, 1, 2, 3].map(i => {
      const chunk = activeData.slice(i * chunkSize, (i + 1) * chunkSize);
      return { label: `W${i + 1}`, value: chunk.reduce((s, d) => s + (isCleanDay(d) ? 0 : d.relapseCount), 0) };
    });
  }
  if (bucketSize === 'month') {
    const months = new Map<string, number>();
    activeData.forEach(d => {
      const m = format(d.date, 'MMM');
      months.set(m, (months.get(m) || 0) + (isCleanDay(d) ? 0 : d.relapseCount));
    });
    return Array.from(months.entries()).map(([label, value]) => ({ label, value }));
  }
  return activeData.slice(-30).map(d => ({
    label: format(d.date, 'd'),
    value: isCleanDay(d) ? 0 : d.relapseCount,
  }));
}

export function buildRelapseState(activeData: any[], targetPerDay: number = 2, firstWeekday: number = 6): RelapseState {
  const totalDays = activeData.length;
  const totalRelapses = activeData.reduce((s, d) => s + (d.relapseCount || 0), 0);
  const totalClean = activeData.filter(isCleanDay).length;
  const avgScore = totalDays > 0 ? Math.round(activeData.reduce((s, d) => s + d.score, 0) / totalDays) : 0;
  const todayScore = activeData.length > 0 ? activeData[activeData.length - 1].score : 0;
  const scoreChange1m = computeScoreChange(activeData, 1);
  const scoreChange1y = computeScoreChange(activeData, 12);

  const { currentStreak, bestStreak, isActive, topStreaks } = computeStreaks(activeData);
  const targetBars = computeTargetBars(activeData, totalRelapses, totalDays, targetPerDay);
  const scoreData = computeScoreData(activeData);
  const barData = computeBarData(activeData, 'week');
  const historyGrid = computeHistoryGrid(activeData, firstWeekday);
  const frequencyCells = computeFrequencyCells(activeData, firstWeekday);
  const weekdayTotals = computeWeekdayTotals(activeData, firstWeekday);
  const totalWeekday = weekdayTotals.reduce((a, b) => a + b, 0);
  const satIdx = (6 - firstWeekday + 7) % 7;
  const sunIdx = (0 - firstWeekday + 7) % 7;
  const weekendTotal = weekdayTotals[satIdx] + weekdayTotals[sunIdx];
  const weekendPct = totalWeekday > 0 ? Math.round((weekendTotal / totalWeekday) * 100) : 0;
  const maxWeekday = Math.max(...weekdayTotals, 1);

  return {
    totalDays, totalRelapses, totalClean, avgScore, todayScore,
    scoreChange1m, scoreChange1y,
    currentStreak, bestStreak, isActive, topStreaks,
    targetBars, scoreData, barData, historyGrid, frequencyCells,
    weekdayTotals, maxWeekday, weekendPct,
  };
}
