import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { offlineDb } from '../lib/offlineDb.ts';
import { ScreenTime } from '../plugins/screenTimePlugin.ts';
import { getBehavioralToday, getLogicalDateStr } from '../lib/dateUtils.ts';

export function usePersistentScreenTime() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchAndPersist = async () => {
      try {
        const { granted } = await ScreenTime.hasUsageAccessPermission();
        if (!granted) return;

        const settings = await offlineDb.getSettings();
        const boundaryHour = settings?.day_boundary_hour ?? 3;
        const today = getBehavioralToday(boundaryHour);
        const dateStr = getLogicalDateStr(today);

        const result = await ScreenTime.getTodayScreenTime();
        console.log('[ScreenTime] Fetched screen time:', result);
        if (!result) {
          console.warn('[ScreenTime] getTodayScreenTime returned null/undefined');
          return;
        }

        console.log('[ScreenTime] Persisting for dateStr:', dateStr, 'totalMinutes:', result.totalMinutes, 'appsCount:', result.apps?.length);
        await offlineDb.updateDay(dateStr, {
          total_screen_minutes: result.totalMinutes ?? 0,
          app_usages: (result.apps || []).map(a => ({
            appName: a.appName,
            packageName: a.packageName,
            minutes: a.minutes,
          })),
        });
        console.log('[ScreenTime] Persist complete');
      } catch (e) {
        console.error('[ScreenTime] Failed to fetch or persist screen time:', e);
      }
    };

    fetchAndPersist();

    let removeAppListener: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) fetchAndPersist();
    }).then(h => { removeAppListener = h.remove; })
      .catch(() => {});

    intervalRef.current = setInterval(fetchAndPersist, 300000);

    return () => {
      if (removeAppListener) removeAppListener();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
