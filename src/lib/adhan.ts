import { Coordinates, CalculationMethod, PrayerTimes, SunnahTimes } from 'adhan';
import type { PrayerName } from '../types';

export const ON_TIME_WINDOW_MINUTES = 30;

export interface PrayerTimeMap {
  fajr: Date; dhuhr: Date; asr: Date; maghrib: Date; isha: Date;
  lastThirdOfNight: Date; middleOfNight: Date; sunrise: Date;
}

const CAIRO_COORDS = new Coordinates(30.0444, 31.2357);
const CAIRO_METHOD = CalculationMethod.Egyptian;

export function getCityPrayerTimes(date: Date): PrayerTimeMap {
  const params = CAIRO_METHOD();
  const pt     = new PrayerTimes(CAIRO_COORDS, date, params);
  const st     = new SunnahTimes(pt);

  return {
    fajr:             pt.fajr,
    dhuhr:            pt.dhuhr,
    asr:              pt.asr,
    maghrib:          pt.maghrib,
    isha:             pt.isha,
    sunrise:          pt.sunrise,
    lastThirdOfNight: st.lastThirdOfTheNight,
    middleOfNight:    st.middleOfTheNight,
  };
}

const PRAYER_ORDER: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const MANDATORY_PRAYERS: PrayerName[] = PRAYER_ORDER;

/**
 * Prayers that have a sunnah (supererogatory) component.
 * Asr is intentionally excluded — per Islamic practice, there is no
 * sunnah prayer before or after Asr (except nafl, which is not tracked here).
 */
export const PRAYERS_WITH_SUNNAH: PrayerName[] = ['fajr', 'dhuhr', 'maghrib', 'isha'];

export const PRAYER_DISPLAY: Record<string, string> = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha'
};

export function getNextPrayer(name: PrayerName): PrayerName | null {
  const idx = PRAYER_ORDER.indexOf(name);
  if (idx === -1 || idx === PRAYER_ORDER.length - 1) return null;
  return PRAYER_ORDER[idx + 1];
}

export function getWindowEnd(name: PrayerName, times: PrayerTimeMap): Date | null {
  switch (name) {
    case 'fajr': return times.sunrise;
    case 'asr':  return times.maghrib;
    case 'dhuhr': return times.asr;
    case 'maghrib': return times.isha;
    case 'isha': return null;
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

export function getNextAdhan(name: PrayerName, times: PrayerTimeMap): Date | null {
  const next = getNextPrayer(name);
  return next ? times[next] : null;
}

export function getOnTimeEnd(name: PrayerName, times: PrayerTimeMap): Date {
  const adhan = times[name];
  return new Date(adhan.getTime() + ON_TIME_WINDOW_MINUTES * 60 * 1000);
}

export function isOnTime(actualTime: Date, name: PrayerName, times: PrayerTimeMap): boolean {
  const adhan = times[name];
  const onTimeEnd = getOnTimeEnd(name, times);
  return actualTime >= adhan && actualTime <= onTimeEnd;
}
