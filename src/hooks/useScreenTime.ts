import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { offlineDb } from '../lib/offlineDb.ts';
import { ScreenTime } from '../plugins/screenTimePlugin.ts';

export function useScreenTime(dateStr: string, isToday: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isToday || !dateStr) return;

    const fetchAndPersist = async () => {
      try {
        const { granted } = await ScreenTime.hasUsageAccessPermission();
        if (!granted) {
          console.warn('[ScreenTime] Usage access permission not granted');
          return;
        }

        const result = await ScreenTime.getTodayScreenTime();
        if (!result) return;

        await offlineDb.updateDay(dateStr, {
          total_screen_minutes: result.totalMinutes ?? 0,
          app_usages: (result.apps || []).map(a => ({
            appName: a.appName,
            packageName: a.packageName,
            minutes: a.minutes,
          })),
        });
      } catch (e) {
        console.error('[ScreenTime] Failed to fetch or persist screen time:', e);
      }
    };

    // Fetch immediately on mount
    fetchAndPersist();

    // Refresh on app foreground
    let removeAppListener: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) fetchAndPersist();
    }).then(h => { removeAppListener = h.remove; })
      .catch(() => {});

    // Poll every 5 minutes while app is open (UsageStatsManager refreshes at ~15-30 min intervals)
    intervalRef.current = setInterval(fetchAndPersist, 300000);

    return () => {
      if (removeAppListener) removeAppListener();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dateStr, isToday]);
}
