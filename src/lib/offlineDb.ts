import { PrayerLog, RelapseEvent, TrainingLog, UserSettings } from '../types.ts';
import { createEmptyDay, storageService, safeUUID, LocalDayData } from './storageService.ts';
import { EVENTS, STORAGE_KEYS } from './constants.ts';
import { format } from 'date-fns';

export type { LocalDayData };

function notifyError(err: unknown) {
  const msg = (err as Error)?.name === 'QuotaExceededError' ? 'Storage Quota Exceeded' : 'Failed to save data';
  window.dispatchEvent(new CustomEvent(EVENTS.STORAGE_ERROR, { detail: { message: msg } }));
  console.error('[OfflineDB] Save failed:', err);
}

export const offlineDb = {
  init: async () => {
    await storageService.init();
    const allLogs = await storageService.getAllDays();

    const migrationDone = localStorage.getItem(STORAGE_KEYS.MIGRATION_DONE);
    if (migrationDone) {
      // Always refresh subscribers so any data written before init finished
      // (e.g. by usePersistentScreenTime) gets picked up.
      setTimeout(() => {
        window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
        window.dispatchEvent(new Event(EVENTS.SETTINGS_UPDATED));
      }, 0);
      return;
    }

    // Legacy localStorage migration (only if new storage is empty)
    if (Object.keys(allLogs).length === 0) {
      let legacyData = localStorage.getItem(STORAGE_KEYS.APP_DATA_V2);
      if (!legacyData) {
        const v1Data = localStorage.getItem(STORAGE_KEYS.APP_DATA_V1);
        if (v1Data) {
          legacyData = v1Data;
          localStorage.setItem(STORAGE_KEYS.APP_DATA_V2, v1Data);
          localStorage.removeItem(STORAGE_KEYS.APP_DATA_V1);
        }
      }
      if (legacyData) {
        try {
          const parsed = JSON.parse(legacyData);
          for (const [date, log] of Object.entries(parsed)) {
            await storageService.updateDay(date, log as Partial<LocalDayData>);
          }
        } catch (e) {
          console.error('[OfflineDB] Migration failed for logs', e);
        }
      }
    }

    // Legacy settings migration
    const storedSettings = await storageService.getSettings();
    if (!storedSettings) {
      const legacySettings = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      if (legacySettings) {
        try {
          const parsed = JSON.parse(legacySettings) as UserSettings;
          await storageService.saveSettings(parsed);
        } catch (e) {
          console.error('[OfflineDB] Migration failed for settings', e);
        }
      }
    }

    // Ensure default settings
    const current = await storageService.getSettings();
    if (!current) {
      const defaultSettings: UserSettings = {
        onboarding_completed: false, notifications_enabled: true,
        prayer_reminder_offset: 15,
        firstWeekday: 6,
      };
      await storageService.saveSettings(defaultSettings);
    }

    // Auto-prune old data based on retention setting
    const settings = current || (await storageService.getSettings());
    const retention = settings?.retention_months ?? 0;
    if (retention > 0) {
      await storageService.pruneOldData(retention);
    }

    localStorage.setItem(STORAGE_KEYS.MIGRATION_DONE, '1');
    window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
    window.dispatchEvent(new Event(EVENTS.SETTINGS_UPDATED));
    return;
  },


  resetAllData: async () => {
    await storageService.clearAll();
    window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
  },

  getSettings: async (): Promise<UserSettings | null> => {
    return storageService.getSettings();
  },

  saveSettings: async (settings: UserSettings): Promise<void> => {
    try {
      await storageService.saveSettings(settings);
    } catch (err: unknown) {
      console.error('[OfflineDB] Save settings failed:', err);
      window.dispatchEvent(new CustomEvent(EVENTS.STORAGE_ERROR, { detail: { message: 'Failed to save settings' } }));
    }
  },

  getAllDays: (): Record<string, LocalDayData> => {
    return storageService.getSnapshot();
  },

  _replaceAllData: async (data: Record<string, LocalDayData>) => {
    await storageService.replaceAllData(data);
    window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
  },

  getDay: (dateStr: string): Promise<LocalDayData | null> => {
    return storageService.getDay(dateStr);
  },

  getCachedDay: (dateStr: string): LocalDayData | null => {
    return storageService.getCachedDay(dateStr);
  },

  updateDay: (dateStr: string, updates: Partial<LocalDayData>): Promise<void> => {
    return storageService.updateDay(dateStr, updates).catch(notifyError);
  },

  saveWeight: (dateStr: string, weight: number): Promise<void> => {
    return offlineDb.updateDay(dateStr, { weight });
  },

  addRelapse: (dateStr: string, relapse: Partial<RelapseEvent>): Promise<void> => {
    const newRelapse: RelapseEvent = { ...relapse, id: safeUUID() } as RelapseEvent;
    return storageService.mutateDay(dateStr, (day) => {
      const base = day || createEmptyDay(dateStr);
      return { relapses: [...base.relapses, newRelapse] };
    }).catch(notifyError);
  },

  updateRelapse: (dateStr: string, id: string, updates: Partial<RelapseEvent>): Promise<void> => {
    return storageService.mutateDay(dateStr, (day) => {
      if (!day) return {};
      return { relapses: day.relapses.map(r => r.id === id ? { ...r, ...updates } : r) };
    }).catch(notifyError);
  },

  deleteRelapse: (dateStr: string, id: string): Promise<void> => {
    return storageService.mutateDay(dateStr, (day) => {
      if (!day) return {};
      return { relapses: day.relapses.filter(r => r.id !== id) };
    }).catch(notifyError);
  },

  setQada: (dateStr: string, count: number): Promise<void> => {
    return storageService.updateDay(dateStr, { qada_count: count }).catch(notifyError);
  },

  pruneOldData: async (retentionMonths: number): Promise<number> => {
    return storageService.pruneOldData(retentionMonths);
  },

  savePrayer: (dateStr: string, prayerName: PrayerLog['name'], data: Partial<PrayerLog>): Promise<void> => {
    return storageService.mutateDay(dateStr, (day) => {
      const base = day || createEmptyDay(dateStr);
      const existing = base.prayers[prayerName] || {} as PrayerLog;
      return {
        prayers: { ...base.prayers, [prayerName]: { ...existing, ...data, name: prayerName } },
      };
    }).catch(notifyError);
  },

  addTraining: (dateStr: string, training: Partial<TrainingLog>): Promise<void> => {
    const newTraining: TrainingLog = { ...training, id: safeUUID() } as TrainingLog;
    return storageService.mutateDay(dateStr, (day) => {
      const base = day || createEmptyDay(dateStr);
      return { trainings: [...base.trainings, newTraining] };
    }).catch(notifyError);
  },

  updateTraining: (dateStr: string, id: string, updates: Partial<TrainingLog>): Promise<void> => {
    return storageService.mutateDay(dateStr, (day) => {
      if (!day) return {};
      return { trainings: day.trainings.map(t => t.id === id ? { ...t, ...updates } : t) };
    }).catch(notifyError);
  },

  deleteTraining: (dateStr: string, id: string): Promise<void> => {
    return storageService.mutateDay(dateStr, (day) => {
      if (!day) return {};
      return { trainings: day.trainings.filter(t => t.id !== id) };
    }).catch(notifyError);
  },

  subscribeToSettings: (callback: (settings: UserSettings | null) => void) => {
    return storageService.subscribeToSettings(callback);
  },

  subscribeToDay: (dateStr: string, callback: (data: LocalDayData) => void) => {
    return storageService.subscribeToDay(dateStr, callback);
  },

  getAllLogs: (): LocalDayData[] => {
    return Object.values(storageService.getSnapshot());
  },

  exportData: (): string => {
    const data = { settings: storageService.getCachedSettings(), daily_logs: storageService.getSnapshot() };
    return JSON.stringify(data, null, 2);
  },

  importData: async (json: string, mode: 'merge' | 'replace' = 'replace') => {
    try {
      const parsed = JSON.parse(json);
      const validation = offlineDb.validateImport(parsed);
      if (!validation.valid) throw new Error(validation.error);

      if (parsed.settings) await offlineDb.saveSettings(parsed.settings);
      const logs = parsed.daily_logs || parsed.logs;
      if (logs) {
        if (mode === 'merge') {
          const merged = { ...storageService.getSnapshot(), ...logs };
          await offlineDb._replaceAllData(merged);
        } else {
          await offlineDb._replaceAllData(logs);
        }
      }
      return true;
    } catch (e: unknown) {
      console.error('Import failed:', e);
      return false;
    }
  },

  validateImport: (data: any): { valid: boolean; daysCount: number; firstDate: string; lastDate: string; error?: string } => {
    return storageService.validateImport(data);
  },

  integrityCheck: async (): Promise<{ totalDays: number; expectedDays: number; pctComplete: number; gaps: string[]; warnings: string[] }> => {
    const allDays = await storageService.getAllDays();
    const dates = Object.keys(allDays).sort();
    const result = { totalDays: 0, expectedDays: 0, pctComplete: 0, gaps: [] as string[], warnings: [] as string[] };

    if (dates.length === 0) {
      result.warnings.push('No days loaded yet');
      return result;
    }

    result.totalDays = dates.length;

    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    const diffMs = last.getTime() - first.getTime();
    result.expectedDays = Math.round(diffMs / 86400000) + 1;
    result.pctComplete = Math.round((result.totalDays / result.expectedDays) * 100);

    // Find gaps
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const gapDays = Math.round((curr.getTime() - prev.getTime()) / 86400000) - 1;
      if (gapDays > 0) {
        const gapStart = new Date(prev);
        gapStart.setDate(gapStart.getDate() + 1);
        const gapEnd = new Date(curr);
        gapEnd.setDate(gapEnd.getDate() - 1);
        result.gaps.push(`${format(gapStart, 'MMM d')} – ${format(gapEnd, 'MMM d')} (${gapDays} day${gapDays > 1 ? 's' : ''})`);
      }
    }

    if (result.totalDays < result.expectedDays * 0.5) {
      result.warnings.push(`Only ${result.totalDays}/${result.expectedDays} days have data (${result.pctComplete}%) between ${dates[0]} and ${dates[dates.length - 1]}`);
    }
    if (result.gaps.length > 0) {
      result.warnings.push(`Found ${result.gaps.length} gap${result.gaps.length > 1 ? 's' : ''} in the data`);
    }

    return result;
  },
};
