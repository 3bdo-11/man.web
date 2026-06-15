import { useMemo } from 'react';
import { getCityPrayerTimes, PrayerTimeMap } from '../lib/adhan.ts';

const cache = new Map<string, PrayerTimeMap>();

export function usePrayerTimes(date: Date): PrayerTimeMap {
  return useMemo(() => {
    const key = date.toISOString().slice(0, 10);
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const times = getCityPrayerTimes(date);
    if (cache.size >= 50) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    cache.set(key, times);
    return times;
  }, [date]);
}
