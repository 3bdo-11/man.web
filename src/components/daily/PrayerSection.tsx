import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Check, Edit3, Clock, Trash2, Star, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { offlineDb } from '../../lib/offlineDb.ts';
import { PrayerLog, PrayerName, UserSettings } from '../../types.ts';
import { format, getDay } from 'date-fns';
import { safeParseDate } from '../../lib/dateUtils.ts';
import { MANDATORY_PRAYERS, PRAYER_DISPLAY, PRAYERS_WITH_SUNNAH, getWindowEnd, getNextAdhan, isOnTime, PrayerTimeMap } from '../../lib/adhan.ts';
import { cn } from '../../lib/cn.ts';
import { haptic } from '../../lib/haptic.ts';

interface Props {
  prayers: Record<string, PrayerLog>;
  prayerTimes: PrayerTimeMap;
  dateStr: string;
  viewDate: Date;
  settings: UserSettings | null;
  qadaCount?: number;
  onQadaChange?: (count: number) => void;
}

export default function PrayerSection({ prayers, prayerTimes, dateStr, viewDate, settings, qadaCount = 0, onQadaChange }: Props) {
  const [tick, setTick] = useState(0);
  const autoMissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const now = new Date();
    for (const p of MANDATORY_PRAYERS) {
      const log = prayers[p];
      if (log?.status === 'prayed' || log?.status === 'missed' || log?.status === 'qada') continue;
      if (autoMissedRef.current.has(p)) continue;
      const windowEnd = getWindowEnd(p, prayerTimes);
      if (windowEnd && now > windowEnd) {
        autoMissedRef.current.add(p);
        offlineDb.savePrayer(dateStr, p, {
          name: p,
          status: 'missed',
          sunnah_flag: false,
          actual_time: windowEnd.toISOString(),
          target_time: prayerTimes[p]?.toISOString() ?? null,
          on_time: false,
        }).catch((e) => console.error('[AutoMiss]', e));
      }
    }
  }, [tick, dateStr, prayers, prayerTimes]);

  const urgencyWarning = useMemo(() => {
    const now = new Date();
    for (const p of MANDATORY_PRAYERS) {
      const time = prayerTimes[p];
      const log = prayers[p];
      if (log?.status === 'prayed' || log?.status === 'qada') continue;
      const windowEnd = getWindowEnd(p, prayerTimes);

      if (time && now > time && (!windowEnd || now < windowEnd)) {
        if (windowEnd) {
          const diff = (windowEnd.getTime() - now.getTime()) / 60000;
          if (diff <= 15) return `${PRAYER_DISPLAY[p]} auto-misses at ${format(windowEnd, 'hh:mm a')} — pray now.`;
        }
      }
    }
    return null;
  }, [prayerTimes, prayers, tick]);
  
  const [editingName, setEditingName] = useState<PrayerName | null>(null);
  const [editTime, setEditTime] = useState('');
  
  const [removingName, setRemovingName] = useState<PrayerName | null>(null);

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (removingTimeoutRef.current) clearTimeout(removingTimeoutRef.current);
  }, []);

  const autoSaveTime = useCallback((name: PrayerName, timeStr: string) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      const [h, m] = timeStr.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const newDate = new Date(viewDate);
      newDate.setHours(h, m, 0, 0);
      const log = prayers[name];
      offlineDb.savePrayer(dateStr, name, {
        name,
        status: 'prayed',
        actual_time: newDate.toISOString(),
        sunnah_flag: log?.sunnah_flag ?? false,
        on_time: isOnTime(newDate, name, prayerTimes),
        target_time: prayerTimes[name]?.toISOString() ?? null,
      });
    }, 400);
  }, [dateStr, viewDate, prayers, prayerTimes]);

  const adjustTime = (delta: number) => {
    const [h, m] = editTime.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const total = h * 60 + m + delta;
    const newH = ((total % 1440) + 1440) % 1440;
    const newM = newH % 60;
    const newHour = Math.floor(newH / 60);
    const newTime = `${String(newHour).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    setEditTime(newTime);
    if (editingName) autoSaveTime(editingName, newTime);
  };

  const togglePrayer = async (name: PrayerName, sunnah: boolean) => {
    const existing = prayers[name];
    if (existing?.status === 'prayed') return;

    const now = new Date();
    const target = prayerTimes[name] || now;

    const effectiveNow = new Date(viewDate);
    effectiveNow.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    const on_time = isOnTime(effectiveNow, name, prayerTimes);

    try {
      haptic[sunnah ? 'prayerSunnah' : 'prayerFard']();
      await offlineDb.savePrayer(dateStr, name, {
        name,
        status: 'prayed',
        sunnah_flag: sunnah,
        actual_time: effectiveNow.toISOString(),
        target_time: target.toISOString(),
        on_time,
      });
    } catch (e: any) {
      console.error('Error logging prayer:', e);
    }
  };

  const markMissed = async (name: PrayerName) => {
    const existing = prayers[name];
    if (existing?.status !== 'pending' && existing?.status !== undefined) return;
    const now = new Date();
    await offlineDb.savePrayer(dateStr, name, {
      name,
      status: 'missed',
      sunnah_flag: false,
      actual_time: now.toISOString(),
      target_time: prayerTimes[name]?.toISOString() ?? null,
      on_time: false,
    });
    haptic.light();
  };

  const toggleSunnah = async (name: PrayerName) => {
    const existing = prayers[name];
    if (existing?.status !== 'prayed' || !PRAYERS_WITH_SUNNAH.includes(name)) return;
    await offlineDb.savePrayer(dateStr, name, {
      ...existing,
      sunnah_flag: !existing.sunnah_flag,
    });
    haptic.light();
  };

  const toggleQada = async (name: PrayerName) => {
    const existing = prayers[name];
    if (existing?.status === 'prayed' || existing?.status === 'qada') return;
    const now = new Date();
    await offlineDb.savePrayer(dateStr, name, {
      name,
      status: 'qada',
      sunnah_flag: false,
      actual_time: now.toISOString(),
      target_time: prayerTimes[name]?.toISOString() ?? null,
      on_time: false,
    });
    onQadaChange?.(qadaCount + 1);
    haptic.light();
  };

  const openEdit = (p: PrayerLog) => {
    if (editingName === p.name) {
        setEditingName(null);
        return;
    }
    setEditingName(p.name);
    const date = safeParseDate(p.actual_time);
    setEditTime(format(date, 'HH:mm'));
  };

  const handleDelete = async (name: PrayerName) => {
    if (removingName === name) {
      const day = await offlineDb.getDay(dateStr);
      if (!day) return;
      const wasQada = day.prayers?.[name]?.status === 'qada';
      const newPrayers = { ...day.prayers };
      delete newPrayers[name];
      await offlineDb.updateDay(dateStr, { prayers: newPrayers });
      if (wasQada) onQadaChange?.(Math.max(0, qadaCount - 1));
      setRemovingName(null);
      setEditingName(null);
    } else {
      setRemovingName(name);
      if (removingTimeoutRef.current) clearTimeout(removingTimeoutRef.current);
      removingTimeoutRef.current = setTimeout(() => setRemovingName(null), 2000);
    }
  };

  const isFriday = getDay(viewDate) === 5;

  const formatTimeRemaining = (targetTime: Date) => {
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="section-header">Prayer</h2>
      </div>
      <div className="card p-0 overflow-hidden divide-y divide-slate-50">
        {MANDATORY_PRAYERS.map(p => {
          const log = prayers[p];
          const time = prayerTimes[p];
          const now = new Date();
          const windowEnd = getWindowEnd(p, prayerTimes);
          const nextAdhan = getNextAdhan(p, prayerTimes);
          
          const missTime = windowEnd || nextAdhan;
          const isActive = time && now > time && (!missTime || now < missTime);
          const isMissed = missTime && now > missTime && log?.status !== 'prayed' && log?.status !== 'qada';
          const isUpcoming = time && now < time;
          const isFardOnly = log?.status === 'prayed' && !log.sunnah_flag;
          const isFardSunnah = log?.status === 'prayed' && log.sunnah_flag;
          const isLate = log?.status === 'prayed' && !log.on_time;
          const isQada = log?.status === 'qada';

          const displayName = isFriday && p === 'dhuhr' ? 'JUMU\'AH' : PRAYER_DISPLAY[p].toUpperCase();

          const timeRemaining = isUpcoming && time ? formatTimeRemaining(time) : null;

          return (
            <div key={p} className="flex flex-col">
              <motion.div
                whileTap={log?.status !== 'prayed' && !isUpcoming ? { scale: 0.97 } : { scale: 0.99 }}
                transition={{ duration: 0.1 }}
                className={cn(
                  "prayer w-full flex items-center justify-between py-4 px-5 select-none text-left min-h-14",
                  isQada ? "prayer-qada" :
                  isFardSunnah ? "prayer-sunnah" :
                  isFardOnly && isLate ? "prayer-late" :
                  isFardOnly ? "prayer-fard" :
                  isMissed ? "prayer-missed" :
                  isActive ? "prayer-active" : "prayer-upcoming"
                )}
                onClick={() => {
                  if (log?.status === 'prayed' || log?.status === 'qada') openEdit(log);
                  else if (log?.status === 'missed' || isMissed) toggleQada(p);
                  else if (!isUpcoming) togglePrayer(p, false);
                }}
                role="button"
                tabIndex={isUpcoming && log?.status !== 'prayed' ? -1 : 0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-20">
                    <p className="text-[15px] font-bold">{displayName}</p>
                  </div>
                  {time && (
                    <p className={cn("text-xs font-bold tabular-nums", isUpcoming ? "opacity-80" : "opacity-60")}>
                      {isUpcoming && timeRemaining ? timeRemaining : format(time, 'hh:mm a')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className={cn("text-[10px] font-bold uppercase tracking-widest", isLate && "text-amber-400", isQada && "text-emerald-400")}>
                    {isQada ? 'QADA' :
                     isFardSunnah ? 'FARD+SUNNAH' :
                     isFardOnly && isLate ? 'LATE' :
                     isFardOnly ? 'FARD' :
                     isMissed ? 'MISSED' :
                     isActive ? 'ACTIVE' : 'UPCOMING'}
                  </div>
                  {log?.status === 'prayed' && PRAYERS_WITH_SUNNAH.includes(p) && (
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSunnah(p); }}
                      className="p-1.5 rounded-full hover:bg-white/40 transition-colors"
                      aria-label={log.sunnah_flag ? 'Remove sunnah' : 'Add sunnah'}
                    >
                      <Star size={14} className={log.sunnah_flag ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                    </button>
                  )}
                  {!log && (isUpcoming ? <Clock size={14} className="opacity-40" /> : <Check size={14} />)}
                  {log && log.status !== 'missed' && log.status !== 'qada' && (
                    <span className="opacity-30">
                      <Edit3 size={14} />
                    </span>
                  )}
                </div>
              </motion.div>

              <AnimatePresence>
                {editingName === p && log && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="bg-slate-50 mx-2 p-4 rounded-2xl my-2 space-y-4">
                      <div className="space-y-2">
                        <label htmlFor={`time-${p}`} className="text-xs font-semibold text-slate-400">Time</label>
                        <div className="flex items-center gap-2">
                          <button type="button"
                            onClick={() => adjustTime(-5)}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
                            aria-label="Subtract 5 minutes"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            id={`time-${p}`}
                            type="time"
                            value={editTime}
                            onChange={(e) => {
                              setEditTime(e.target.value);
                              if (editingName) autoSaveTime(editingName, e.target.value);
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none text-center tabular-nums"
                          />
                          <button type="button"
                            onClick={() => adjustTime(5)}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
                            aria-label="Add 5 minutes"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                      </div>
                      <div className="flex gap-2 items-center justify-between">
                        <button type="button"
                          onClick={() => setEditingName(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          Done
                        </button>
                        <button type="button"
                          onClick={() => handleDelete(p)}
                          className={cn("text-red-400 text-xs font-semibold flex items-center gap-1 hover:text-red-600 transition-colors", removingName === p && "text-red-700")}
                        >
                          {removingName === p ? 'Confirm?' : 'Remove'}
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {urgencyWarning && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse animate-duration-[3000ms]" />
          <p className="text-xs text-red-700 font-semibold tracking-tight">{urgencyWarning}</p>
        </div>
      )}

    </section>
  );
}
