import { PrayerName } from '../types.ts';
import { PRAYER_DISPLAY } from '../lib/adhan.ts';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

function sendWebNotification(title: string, body: string) {
  if (!('Notification' in globalThis)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

let notifIdCounter: number = (() => {
  try { return parseInt(localStorage.getItem('man_notif_id_counter') || '100', 10); }
  catch { return 100; }
})();

function getNextId(): number {
  const id = notifIdCounter++;
  try { localStorage.setItem('man_notif_id_counter', String(notifIdCounter)); }
  catch { /* localStorage may be full */ }
  return id;
}

export const notificationService = {
  checkPermission: async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        return perm.display === 'granted';
      } catch {
        return false;
      }
    }
    if (!('Notification' in globalThis)) return false;
    return Notification.permission === 'granted';
  },

  requestPermission: async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await LocalNotifications.requestPermissions();
        return perm.display === 'granted';
      } catch {
        return false;
      }
    }
    if (!('Notification' in globalThis)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  schedulePrayerReminder: async (prayerName: PrayerName, time: Date, offsetMinutes: number, dateStr: string) => {
    const reminderTime = new Date(time.getTime() - offsetMinutes * 60000);
    const now = new Date();
    if (reminderTime <= now) return;

    if (Capacitor.isNativePlatform()) {
      const id = getNextId();
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title: `Time for ${PRAYER_DISPLAY[prayerName]}`,
          body: `${PRAYER_DISPLAY[prayerName]} is in ${offsetMinutes} minutes.`,
          schedule: { at: reminderTime },
          extra: { prayerName, dateStr, type: 'reminder' },
        }],
      });
    } else {
      const delay = reminderTime.getTime() - now.getTime();
      if (delay <= 0) return;
      setTimeout(() => sendWebNotification(
        `Time for ${PRAYER_DISPLAY[prayerName]}`,
        `${PRAYER_DISPLAY[prayerName]} is in ${offsetMinutes} minutes.`
      ), delay);
    }
  },

  scheduleMissedPrayerCheck: async (
    prayerName: PrayerName,
    nextPrayerStartTime: Date,
    checkMissed: () => boolean | Promise<boolean>,
    dateStr: string
  ) => {
    const now = new Date();
    if (nextPrayerStartTime <= now) return;

    const delay = nextPrayerStartTime.getTime() - now.getTime();
    if (delay <= 0) return;
    setTimeout(async () => {
      const shouldSkip = await checkMissed();
      if (shouldSkip) return;
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [{
            id: getNextId(),
            title: `Missed ${PRAYER_DISPLAY[prayerName]}!`,
            body: `You haven't logged your ${PRAYER_DISPLAY[prayerName]} and the next prayer is starting.`,
            schedule: { at: new Date(Date.now() + 1000) },
            extra: { prayerName, dateStr, type: 'missed-check' },
          }],
        });
      } else {
        sendWebNotification(
          `Missed ${PRAYER_DISPLAY[prayerName]}!`,
          `You haven't logged your ${PRAYER_DISPLAY[prayerName]} and the next prayer is starting.`
        );
      }
    }, delay);
  },

  show: (title: string, body: string) => {
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.schedule({
        notifications: [{
          id: getNextId(),
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
        }],
      });
    } else {
      sendWebNotification(title, body);
    }
  },

  cancelAll: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        const ids = pending.notifications.map(n => ({ id: n.id }));
        if (ids.length > 0) {
          await LocalNotifications.cancel({ notifications: ids });
        }
      } catch {
        // silently fail
      }
    }
  },
};
