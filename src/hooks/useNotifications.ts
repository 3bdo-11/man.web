import { useEffect, useRef } from 'react';
import { offlineDb } from '../lib/offlineDb.ts';
import { STORAGE_KEYS } from '../lib/constants.ts';
import { getCityPrayerTimes, MANDATORY_PRAYERS, PRAYER_DISPLAY } from '../lib/adhan.ts';
import { notificationService } from '../services/notificationService.ts';
import { UserSettings } from '../types.ts';

export function useNotifications(userSettings: UserSettings | null) {
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!userSettings?.notifications_enabled) {
      notificationService.cancelAll();
      return;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lastTz = localStorage.getItem(STORAGE_KEYS.TIMEZONE);
    if (lastTz && lastTz !== tz) {
      notificationService.cancelAll();
    }
    localStorage.setItem(STORAGE_KEYS.TIMEZONE, tz);

    const localOffset = -new Date().getTimezoneOffset() / 60;
    if (Math.abs(localOffset) > 14) {
      console.warn(`[App] Unusual timezone offset: ${localOffset}. Prayer times may be incorrect.`);
    }

    const now = new Date();
    const todayTimes = getCityPrayerTimes(now);
    const todayStr = now.toISOString().slice(0, 10);

    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];

    MANDATORY_PRAYERS.forEach((prayerName, index) => {
      const prayerTime = todayTimes[prayerName];
      if (!prayerTime) return;

      if (prayerTime > now) {
        notificationService.schedulePrayerReminder(
          prayerName,
          prayerTime,
          userSettings.prayer_reminder_offset || 15,
          todayStr
        );
      } else {
        (async () => {
          const dayData = await offlineDb.getDay(todayStr);
          const logged = dayData?.prayers?.[prayerName];
          const wasPrayed = logged?.status === 'prayed' || logged?.on_time === true;
          if (!wasPrayed) {
            const timerId = setTimeout(() => {
              notificationService.show(
                `${PRAYER_DISPLAY[prayerName]} was missed`,
                `You haven't logged your ${PRAYER_DISPLAY[prayerName]} today. Log it now if you prayed.`
              );
            }, index * 1000);
            timeoutRefs.current.push(timerId);
          }
        })();
      }

      const nextPrayerName = MANDATORY_PRAYERS[index + 1];
      const checkTime = nextPrayerName ? todayTimes[nextPrayerName] : null;

      if (checkTime) {
        const delay = checkTime.getTime() - now.getTime();
        if (delay > 0) {
          notificationService.scheduleMissedPrayerCheck(
            prayerName,
            checkTime,
            async () => {
              const dayData = await offlineDb.getDay(todayStr);
              return !dayData?.prayers?.[prayerName] || dayData.prayers[prayerName].status !== 'prayed';
            },
            todayStr
          );
        }
      }
    });

    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
      notificationService.cancelAll();
    };
  }, [userSettings?.notifications_enabled, userSettings?.prayer_reminder_offset]);
}