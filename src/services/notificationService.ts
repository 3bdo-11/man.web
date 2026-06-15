import { format } from 'date-fns';
import { PrayerName } from '../types.ts';
import { PRAYER_DISPLAY } from '../lib/adhan.ts';

const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

function sendNotification(title: string, body: string) {
  if (!('Notification' in globalThis)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

function scheduleTimeout(id: string, title: string, body: string, at: Date, check?: () => boolean | Promise<boolean>) {
  const now = new Date();
  const delay = at.getTime() - now.getTime();
  if (delay <= 0) return;

  if (delay > 60000) {
    console.warn('[NotificationService] Web notifications do not survive page close. Install the app or use a supported mobile platform for reliable reminders.');
  }

  const timer = setTimeout(async () => {
    if (check) {
      const result = check();
      const shouldSkip = result instanceof Promise ? await result : result;
      if (shouldSkip) return;
    }
    sendNotification(title, body);
    scheduledTimers.delete(id);
  }, delay);
  scheduledTimers.set(id, timer);
}

export const notificationService = {
  checkPermission: async () => {
    if (!('Notification' in globalThis)) return false;
    return Notification.permission === 'granted';
  },
  requestPermission: async () => {
    if (!('Notification' in globalThis)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  schedulePrayerReminder: (prayerName: PrayerName, time: Date, offsetMinutes: number, dateStr: string) => {
    const reminderTime = new Date(time.getTime() - offsetMinutes * 60000);
    const now = new Date();
    if (reminderTime <= now) return;

    const dateTag = dateStr || format(new Date(), 'yyyy-MM-dd');
    const id = `prayer-reminder-${prayerName}-${dateTag}-${formatTime(reminderTime)}`;
    const title = `Time for ${PRAYER_DISPLAY[prayerName]}`;
    const body = `${PRAYER_DISPLAY[prayerName]} is in ${offsetMinutes} minutes.`;

    scheduleTimeout(id, title, body, reminderTime);
  },

  scheduleMissedPrayerCheck: (prayerName: PrayerName, nextPrayerStartTime: Date, checkMissed: () => boolean | Promise<boolean>, dateStr: string) => {
    const now = new Date();
    if (nextPrayerStartTime <= now) return;

    const dateTag = dateStr || format(new Date(), 'yyyy-MM-dd');
    const id = `prayer-missed-${prayerName}-${dateTag}-${formatTime(nextPrayerStartTime)}`;

    scheduleTimeout(id, `Missed ${PRAYER_DISPLAY[prayerName]}!`,
      `You haven't logged your ${PRAYER_DISPLAY[prayerName]} and the next prayer is starting.`,
      nextPrayerStartTime,
      checkMissed
    );
  },

  show: sendNotification,

  cancelAll: () => {
    for (const [, timer] of scheduledTimers) {
      clearTimeout(timer);
    }
    scheduledTimers.clear();
  },
};

function formatTime(date: Date): string {
  return `${date.getHours()}-${date.getMinutes()}`;
}
