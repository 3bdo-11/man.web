import { useState, useEffect, useMemo, useRef, useReducer } from 'react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { format, subDays, addDays, isSameDay, isBefore, startOfDay, parse } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Smartphone } from 'lucide-react';
import { offlineDb } from '../lib/offlineDb.ts';
import { usePrayerTimes } from '../hooks/usePrayerTimes.ts';
import { AppUsage, PrayerLog, RelapseEvent, TrainingLog, DailyLog, UserSettings } from '../types.ts';
import { getBehavioralToday, getLogicalDateStr } from '../lib/dateUtils.ts';
import { cn } from '../lib/cn.ts';
import { calculateDailyScore, getScoreLevel, getScoreInterpretation } from '../lib/scoring.ts';


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

  const initialCached = offlineDb.getCachedDay(getLogicalDateStr(initialDate));
  console.log('[DailyTracking] Initial cached data for', getLogicalDateStr(initialDate), ':', initialCached?.total_screen_minutes, initialCached ? 'exists' : 'null');

  const [state, dispatch] = useReducer(dailyReducer, {
    viewDate: initialDate,
    relapses: initialCached?.relapses ?? [],
    prayers: initialCached?.prayers ?? {},
    trainings: initialCached?.trainings ?? [],
    weightInput: initialCached?.weight != null ? String(initialCached.weight) : '',
    dailyLog: initialCached ? {
      date: initialCached.dateStr,
      total_screen_minutes: initialCached.total_screen_minutes,
      updated_at: initialCached.updated_at,
      qada_count: initialCached.qada_count,
    } : null,
    appUsages: initialCached?.app_usages || [],
    qadaCount: initialCached?.qada_count ?? 0,
  });

  const { viewDate, relapses, prayers, trainings, weightInput, dailyLog, appUsages, qadaCount } = state;
  const dateStr = getLogicalDateStr(viewDate);
  console.log('[DailyTracking] Render with dailyLog:', dailyLog?.total_screen_minutes, 'dateStr:', dateStr);
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
    return withWeight[0].weight ?? undefined;
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
    console.log('[DailyTracking] Subscribing to day:', dateStr);
    return offlineDb.subscribeToDay(dateStr, (data) => {
      console.log('[DailyTracking] subscribeToDay callback fired with total_screen_minutes:', data.total_screen_minutes, 'for date:', dateStr);
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

  const canGoBack = useMemo(() => {
    const allLogs = offlineDb.getAllLogs();
    return allLogs.some(l => l.dateStr < dateStr);
  }, [dateStr]);

  const canGoForward = useMemo(
    () => isBefore(startOfDay(viewDate), startOfDay(getBehavioralToday(boundaryHour))),
    [viewDate, boundaryHour]
  );

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
          <button type="button"
            onClick={() => dispatch({ type: 'SET_VIEW_DATE', date: subDays(viewDate, 1) })}
            disabled={!canGoBack}
            aria-label="Previous Day"
            className="p-2 rounded-full active:scale-75 touch-manipulation transition-transform hover:bg-slate-50 -ml-1 disabled:opacity-20 disabled:active:scale-100"
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
            <button type="button"
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
              {displayScore}
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
        onWeightSave={(val) => offlineDb.saveWeight(dateStr, Number(val))}
      />

      {/* ── SCREEN TIME ── */}
      <section className="space-y-3">
        <h2 className="section-header">Screen Time</h2>
        <div className="card bg-white border-slate-100 shadow-sm">
          {dailyLog ? (
            <div className="space-y-5">
              <div className="flex items-center gap-5">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                    <circle cx="36" cy="36" r="30" fill="none" strokeWidth="5" strokeLinecap="round"
                      className={(dailyLog.total_screen_minutes ?? 0) <= (settings?.screen_time_target ?? 60) ? 'stroke-emerald-400' : 'stroke-red-400'}
                      strokeDasharray={`${2 * Math.PI * 30}`}
                      strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.min(1, (dailyLog.total_screen_minutes ?? 0) / (settings?.screen_time_target ?? 60)))}`}
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-900 tabular-nums leading-none">
                      {dailyLog.total_screen_minutes ?? 0}
                    </span>
                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">min</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      {isEffectiveToday ? 'Today' : format(viewDate, 'MMM d')}
                    </span>
                    {(dailyLog.total_screen_minutes ?? 0) <= (settings?.screen_time_target ?? 60) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">
                        {(settings?.screen_time_target ?? 60) - (dailyLog.total_screen_minutes ?? 0)}m left
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[9px] font-bold">
                        +{(dailyLog.total_screen_minutes ?? 0) - (settings?.screen_time_target ?? 60)}m over
                      </span>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (dailyLog.total_screen_minutes ?? 0) <= (settings?.screen_time_target ?? 60)
                          ? 'bg-emerald-400'
                          : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.min(100, ((dailyLog.total_screen_minutes ?? 0) / Math.max(1, settings?.screen_time_target ?? 60)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400 font-medium">Used</span>
                    <span className="text-slate-400 font-medium">Target: {settings?.screen_time_target ?? 60}m</span>
                  </div>
                </div>
              </div>
              {topApps.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone size={12} className="text-violet-400" />
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Top Apps</span>
                  </div>
                  <div className="space-y-2">
                    {topApps.map((app, i) => {
                      const colors = ['bg-violet-400', 'bg-blue-400', 'bg-amber-400'];
                      return (
                        <div key={app.appName + '-' + app.minutes} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${colors[i] ?? 'bg-slate-300'}`} />
                            <span className="text-xs font-semibold text-slate-700 truncate">{app.appName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-400"
                                style={{ width: `${Math.min(100, (app.minutes / Math.max(1, dailyLog.total_screen_minutes ?? 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500 tabular-nums w-10 text-right">{app.minutes}m</span>
                          </div>
                        </div>
                      );
                    })}
                    {totalUniqueApps > 3 && (
                      <p className="text-[9px] text-slate-400 font-semibold text-center pt-1">+{totalUniqueApps - 3} more apps</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400">No data yet</p>
                <p className="text-[10px] text-slate-300">Screen time will appear once tracked.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
