import { useState, useEffect, useMemo, useRef, useReducer } from 'react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { format, subDays, addDays, isSameDay, isBefore, startOfDay, parse } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { offlineDb } from '../lib/offlineDb.ts';
import { PRAYER_DISPLAY } from '../lib/adhan.ts';
import { usePrayerTimes } from '../hooks/usePrayerTimes.ts';
import { AppUsage, PrayerLog, PrayerName, RelapseEvent, TrainingLog, DailyLog, UserSettings } from '../types.ts';
import { getBehavioralToday, getLogicalDateStr } from '../lib/dateUtils.ts';
import { cn } from '../lib/cn.ts';
import { calculateDailyScore, getScoreLevel, getScoreInterpretation } from '../lib/scoring.ts';
import { useScreenTime } from '../hooks/useScreenTime.ts';

import RelapseSection  from '../components/daily/RelapseSection.tsx';
import PrayerSection   from '../components/daily/PrayerSection.tsx';
import TrainingSection from '../components/daily/TrainingSection.tsx';
import WeightSection   from '../components/daily/more/WeightSection.tsx';

interface DailyState {
  viewDate: Date;
  relapses: RelapseEvent[];
  prayers: Record<string, PrayerLog>;
  trainings: TrainingLog[];
  weightInput: string;
  dailyLog: DailyLog | null;
  appUsages: AppUsage[];
  qadaCount: number;
}

type DailyAction =
  | { type: 'SET_VIEW_DATE'; date: Date }
  | { type: 'SET_DAY_DATA'; payload: Partial<Pick<DailyState, 'relapses' | 'prayers' | 'trainings' | 'dailyLog' | 'appUsages' | 'weightInput' | 'qadaCount'>> }
  | { type: 'SET_QADA'; count: number }
  | { type: 'SET_WEIGHT'; value: string };

function dailyReducer(state: DailyState, action: DailyAction): DailyState {
  switch (action.type) {
    case 'SET_VIEW_DATE':
      return { ...state, viewDate: action.date };
    case 'SET_DAY_DATA':
      return { ...state, ...action.payload };
    case 'SET_QADA':
      return { ...state, qadaCount: action.count };
    case 'SET_WEIGHT':
      return { ...state, weightInput: action.value };
  }
}

interface Props {
  settings: UserSettings | null;
}

function formatHour(h: number): string {
  if (h === 0) return '12AM';
  if (h < 12) return `${h}AM`;
  if (h === 12) return '12PM';
  return `${h - 12}PM`;
}

function getNextActionColor(action: string): string {
  if (action.includes('✓')) return 'text-emerald-600';
  if (action.includes('due')) return 'text-amber-600';
  return 'text-slate-600';
}

function shouldAnimate(dateStr: string, animPlayed: { current: boolean }): boolean {
  const key = `man_anim_score_${dateStr}`;
  if (sessionStorage.getItem(key)) return false;
  if (animPlayed.current) return false;
  animPlayed.current = true;
  try { sessionStorage.setItem(key, '1'); } catch { console.warn('[DailyTracking] Failed to set session storage'); }
  return true;
}

function computeScoreData(
  dailyLog: DailyLog | null,
  prayers: Record<string, PrayerLog>,
  trainings: TrainingLog[],
  relapses: RelapseEvent[],
  settings: UserSettings | null,
) {
  if (!dailyLog) return { total: 0, prayer: 0, relapse: 0, training: 0, screenTime: 0 };

  const result = calculateDailyScore(dailyLog, Object.values(prayers), trainings, relapses, settings);
  return result;
}

export default function DailyTracking({ settings }: Props) {
  const boundaryHour = settings?.day_boundary_hour ?? 3;
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const parsedDate = dateParam ? parse(dateParam, 'yyyy-MM-dd', new Date()) : null;
  const initialDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : getBehavioralToday(boundaryHour);

  const [state, dispatch] = useReducer(dailyReducer, {
    viewDate: initialDate,
    relapses: [],
    prayers: {},
    trainings: [],
    weightInput: '',
    dailyLog: null,
    appUsages: [],
    qadaCount: 0,
  });

  const { viewDate, relapses, prayers, trainings, weightInput, dailyLog, appUsages, qadaCount } = state;
  const dateStr = getLogicalDateStr(viewDate);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const prayerTimes = usePrayerTimes(viewDate);

  const scoreData = useMemo(
    () => computeScoreData(dailyLog, prayers, trainings, relapses, settings),
    [dailyLog, prayers, trainings, relapses, settings]
  );

  const { total: dailyScore } = scoreData;

  const lastKnownWeight = useMemo(() => {
    const logs = offlineDb.getAllLogs();
    const withWeight = logs.filter(l => l.weight != null);
    if (withWeight.length === 0) return undefined;
    withWeight.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    return withWeight[0].weight;
  }, [dateStr]);

  const { topApps, totalUniqueApps } = useMemo(() => {
    const map: Record<string, number> = {};
    appUsages.forEach(a => {
      const name = a.appName || a.packageName || 'Unknown';
      map[name] = (map[name] || 0) + a.minutes;
    });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return {
      topApps: entries.slice(0, 3).map(([appName, minutes]) => ({ appName, minutes })),
      totalUniqueApps: entries.length,
    };
  }, [appUsages]);

  useEffect(() => {
    if (!dateStr) return;
    return offlineDb.subscribeToDay(dateStr, (data) => {
      dispatch({
        type: 'SET_DAY_DATA',
        payload: {
          dailyLog: {
            date: data.dateStr,
            total_screen_minutes: data.total_screen_minutes,
            updated_at: data.updated_at,
            qada_count: data.qada_count,
          },
          qadaCount: data.qada_count ?? 0,
          relapses: data.relapses,
          prayers: data.prayers,
          trainings: data.trainings,
          appUsages: data.app_usages || [],
          weightInput: data.weight !== null && data.weight !== undefined ? String(data.weight) : '',
        },
      });
    });
  }, [dateStr]);

  const isEffectiveToday = useMemo(
    () => isSameDay(viewDate, getBehavioralToday(boundaryHour)),
    [viewDate, boundaryHour]
  );

  const canGoForward = useMemo(
    () => isBefore(startOfDay(viewDate), startOfDay(getBehavioralToday(boundaryHour))),
    [viewDate, boundaryHour]
  );

  useScreenTime(dateStr, isEffectiveToday);

  const nextAction = useMemo(() => {
    const now = new Date();
    const mandatory: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (const name of mandatory) {
      const time = prayerTimes[name];
      if (!time || prayers[name]?.status === 'prayed') continue;
      if (now >= time) return `${PRAYER_DISPLAY[name]} is due — tap to log`;
      return `Next: ${PRAYER_DISPLAY[name]} at ${format(time, 'hh:mm a')}`;
    }
    return "All prayers done. Mark complete when ready.";
  }, [prayers, prayerTimes, viewDate, tick]);

  const scoreLevel = getScoreLevel(dailyScore);
  const colorMap = { high: 'text-emerald-500', mid: 'text-amber-500', low: 'text-red-400', critical: 'text-slate-500' } as const;
  const strokeMap = { high: '#4ade80', mid: '#fbbf24', low: '#f87171', critical: '#94a3b8' } as const;
  const scoreColor = colorMap[scoreLevel];
  const scoreStroke = strokeMap[scoreLevel];
  const displayScore = Math.max(0, Math.min(100, dailyScore));
  const R = 30;
  const circ = 2 * Math.PI * R;

  const animPlayed = useRef(false);
  const shouldAnimateScore = shouldAnimate(dateStr, animPlayed);
  const dayProgress = Math.min(100, (((new Date().getHours() * 60 + new Date().getMinutes()) - (boundaryHour * 60) + 1440) % 1440) / 1440 * 100);

  const breakdownStats = useMemo(() => [
    { label: 'Prayer', value: scoreData.prayer },
    { label: 'Training', value: scoreData.training },
    { label: 'Relapse', value: scoreData.relapse },
    { label: 'Screen', value: scoreData.screenTime },
  ], [scoreData]);

  return (
    <div className="p-grid flex flex-col gap-grid mx-auto w-full max-w-app">

      {/* ── HEADER: Date nav + Score badge + Progress ── */}
      <section className="card bg-white border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW_DATE', date: subDays(viewDate, 1) })}
            aria-label="Previous Day"
            className="p-2 rounded-full active:scale-75 touch-manipulation transition-transform hover:bg-slate-50 -ml-1"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400 leading-none mb-0.5">
              {isEffectiveToday ? 'TODAY' : format(viewDate, 'EEEE').toUpperCase()}
            </p>
            <p className="text-sm font-bold text-slate-800 tracking-tight">
              {format(viewDate, 'MMM do').toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_DATE', date: addDays(viewDate, 1) })}
              disabled={!canGoForward}
              aria-label="Next Day"
              className="p-2 rounded-full active:scale-75 touch-manipulation transition-transform hover:bg-slate-50 -mr-1 disabled:opacity-20 disabled:active:scale-100"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-[8px] font-semibold text-slate-400 tabular-nums w-8 text-right">{formatHour(boundaryHour)}</span>
          <div className="flex-1 h-1 bg-slate-100 rounded-full relative overflow-hidden"
               role="progressbar"
               aria-valuenow={Math.round(dayProgress)}
               aria-valuemin={0}
               aria-valuemax={100}
               aria-label="Day progress">
            <div className="absolute top-0 left-0 h-full bg-amber-400 rounded-full transition-all" style={{ width: `${dayProgress}%` }} />
          </div>
          <span className="text-[8px] font-semibold text-slate-400 tabular-nums w-8">{formatHour(boundaryHour)}</span>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-baseline gap-3">
            <span className={cn('text-3xl font-black tracking-tighter tabular-nums', scoreColor)}>
              {dailyScore}
            </span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-widest', scoreColor)}>
              {getScoreInterpretation(dailyScore)}
            </span>
          </div>
          <svg className="w-10 h-10 -rotate-90 shrink-0" viewBox="0 0 72 72" role="img" aria-label={`Daily score: ${displayScore} out of 100`}>
            <circle cx="36" cy="36" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <motion.circle
              cx="36" cy="36" r={R}
              fill="none"
              stroke={scoreStroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ * (1 - displayScore / 100) }}
              transition={shouldAnimateScore ? { duration: 1.5, ease: 'easeOut' } : { duration: 0 }}
            />
          </svg>
        </div>
      </section>

      {/* ── SCORE BREAKDOWN ── */}
      <section className="card bg-white border-slate-100 shadow-sm">
        <div className="grid grid-cols-4 gap-3">
          {breakdownStats.map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
              <p className={cn(
                'text-sm font-bold tabular-nums',
                stat.value > 0 && 'text-emerald-600',
                stat.value < 0 && 'text-red-500',
                stat.value === 0 && 'text-slate-300'
              )}>
                {stat.value > 0 ? '+' : ''}{stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRAYER ── */}
      <PrayerSection
        prayers={prayers}
        prayerTimes={prayerTimes}
        dateStr={dateStr}
        viewDate={viewDate}
        settings={settings}
        qadaCount={qadaCount}
        onQadaChange={(count) => {
          dispatch({ type: 'SET_QADA', count });
          offlineDb.setQada(dateStr, count);
        }}
      />

      {/* ── RELAPSE ── */}
      <RelapseSection relapses={relapses} dateStr={dateStr} viewDate={viewDate} settings={settings} />

      {/* ── TRAINING ── */}
      <TrainingSection trainings={trainings} dateStr={dateStr} />

      {/* ── WEIGHT ── */}
      <WeightSection
        weightInput={weightInput}
        lastKnownWeight={lastKnownWeight}
        onWeightChange={(val) => dispatch({ type: 'SET_WEIGHT', value: val })}
        onWeightSave={(val) => offlineDb.saveWeight(dateStr, val)}
      />

      {/* ── SCREEN TIME ── */}
      <section className="space-y-3">
        <h2 className="section-header">Screen Time</h2>
        <div className="card bg-white border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tighter">
                {dailyLog?.total_screen_minutes ?? 0}
              </span>
              <span className="text-xs font-semibold text-slate-400">min</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              {isEffectiveToday ? 'Today' : format(viewDate, 'MMM d')}
            </span>
          </div>
          {topApps.length > 0 && (
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Top Apps</p>
              <div className="space-y-1.5">
                {topApps.map((app) => (
                  <div key={app.appName + '-' + app.minutes} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      <span className="text-xs font-semibold text-slate-700">{app.appName}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">{app.minutes}m</span>
                  </div>
                ))}
              </div>
              {totalUniqueApps > 3 && (
                <p className="text-[9px] text-slate-400 font-semibold pt-1">+{totalUniqueApps - 3} more</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
