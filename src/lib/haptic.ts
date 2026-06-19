let hapticEnabled = true;

export function setHapticEnabled(enabled: boolean) {
  hapticEnabled = enabled;
}

const vibrate = (pattern: number | number[]) => {
  if (!hapticEnabled) return;
  if (typeof navigator?.vibrate === 'function') {
    try { navigator.vibrate(pattern); } catch { /* not supported */ }
  }
};

export const haptic = {
  relapse:    () => vibrate(35),
  prayerFard: () => vibrate(15),
  prayerSunnah: () => vibrate([15, 35, 15]),
  training:   () => vibrate(25),
  weight:     () => vibrate(10),
  error:      () => vibrate([50, 50, 50]),
  success:    () => vibrate([15, 30]),
  light:      () => vibrate(10),
};
