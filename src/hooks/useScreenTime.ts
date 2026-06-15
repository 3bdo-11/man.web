import { useEffect, useRef } from 'react';
import { offlineDb } from '../lib/offlineDb.ts';

/** Browser-only: tracks accumulated visible milliseconds via visibility API. */
const STORAGE_KEY = 'screen_time_today';
function loadAccumulated(dateStr: string): { dateStr: string; ms: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.dateStr === dateStr) return data;
    }
  } catch { console.warn('[useScreenTime] Failed to load screen time from localStorage'); }
  return { dateStr, ms: 0 };
}
function saveAccumulated(dateStr: string, ms: number) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateStr, ms })); } catch { console.warn('[useScreenTime] Failed to save screen time to localStorage'); }
}

export function useScreenTime(dateStr: string, isToday: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isToday || !dateStr) return;

    const collect = async () => {
      try {
        const data = loadAccumulated(dateStr);
        const now = Date.now();
        const sessionMs = sessionStartRef.current !== null ? now - sessionStartRef.current : 0;
        const totalMinutes = Math.round((data.ms + sessionMs) / 60000);

        await offlineDb.updateDay(dateStr, {
          total_screen_minutes: totalMinutes,
        });
      } catch {
        // silently skip
      }
    };

    // Session tracking via visibility API
    const onVisible = () => { sessionStartRef.current = Date.now(); };
    const onHidden = () => {
      if (sessionStartRef.current !== null) {
        const data = loadAccumulated(dateStr);
        data.ms += Date.now() - sessionStartRef.current;
        saveAccumulated(dateStr, data.ms);
        sessionStartRef.current = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) onHidden(); else onVisible();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisible);
    window.addEventListener('blur', onHidden);
    if (!document.hidden) onVisible();

    collect();
    intervalRef.current = setInterval(collect, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Flush session on cleanup
      if (sessionStartRef.current !== null) {
        const data = loadAccumulated(dateStr);
        data.ms += Date.now() - sessionStartRef.current;
        saveAccumulated(dateStr, data.ms);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('blur', onHidden);
    };
  }, [dateStr, isToday]);
}
