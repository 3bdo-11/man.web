import { openDB, IDBPDatabase } from 'idb';
import { format, subMonths, parseISO } from 'date-fns';
import { AppUsage, RelapseEvent, PrayerLog, TrainingLog, UserSettings } from '../types.ts';
import { EVENTS, DB } from './constants.ts';

export interface LocalDayData {
  dateStr: string;
  total_screen_minutes: number;
  relapses: RelapseEvent[];
  prayers: Record<string, PrayerLog>;
  trainings: TrainingLog[];
  weight: number | null;
  updated_at: string;
  qada_count?: number;
  day_completed?: boolean;
  app_usages?: AppUsage[];
}

export function createEmptyDay(dateStr: string): LocalDayData {
  return {
    dateStr,
    total_screen_minutes: 0,
    relapses: [],
    prayers: {},
    trainings: [],
    weight: null,
    updated_at: new Date().toISOString(),
    app_usages: [],
  };
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

type QueueItemBase = {
  resolve: (value: void) => void;
  reject: (err: unknown) => void;
};

type UpdateQueueItem = QueueItemBase & {
  kind: 'update';
  updates: Partial<LocalDayData>;
};

type MutateQueueItem = QueueItemBase & {
  kind: 'mutate';
  mutator: (day: LocalDayData | null) => Partial<LocalDayData>;
};

type WriteQueueItem = UpdateQueueItem | MutateQueueItem;

export class StorageService {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private memoryCache: Record<string, LocalDayData> = {};
  private settingsCache: UserSettings | null = null;
  private writeQueues = new Map<string, WriteQueueItem[]>();
  private processingKeys = new Set<string>();
  private pendingWrites = 0;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    const db = await this.getDB();
    const keys = await db.getAllKeys(DB.LOGS_STORE);
    const values = await db.getAll(DB.LOGS_STORE);
    this.memoryCache = {};
    keys.forEach((key, i) => {
      this.memoryCache[key as string] = values[i];
    });
    this.settingsCache = (await db.get(DB.SETTINGS_STORE, 'current')) as UserSettings | null;
  }

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB.NAME, DB.VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(DB.LOGS_STORE)) {
            db.createObjectStore(DB.LOGS_STORE);
          }
          if (!db.objectStoreNames.contains(DB.SETTINGS_STORE)) {
            db.createObjectStore(DB.SETTINGS_STORE);
          }
        },
      });
    }
    return this.dbPromise;
  }

  getSnapshot(): Record<string, LocalDayData> {
    const copy: Record<string, LocalDayData> = {};
    for (const [k, v] of Object.entries(this.memoryCache)) {
      copy[k] = { ...v };
    }
    return copy;
  }

  getCachedDay(dateStr: string): LocalDayData | null {
    const cached = this.memoryCache[dateStr];
    return cached ? { ...cached } : null;
  }

  async getDay(dateStr: string): Promise<LocalDayData | null> {
    await this.init();
    const cached = this.memoryCache[dateStr];
    if (cached) return { ...cached };
    try {
      const db = await this.getDB();
      const stored = await db.get(DB.LOGS_STORE, dateStr);
      if (stored) {
        this.memoryCache[dateStr] = stored;
        return { ...stored };
      }
    } catch { console.warn('[StorageService] Read error for', dateStr); }
    return null;
  }

  /** Enqueue a write with pre-computed updates. */
  updateDay(dateStr: string, updates: Partial<LocalDayData>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.writeQueues.has(dateStr)) {
        this.writeQueues.set(dateStr, []);
      }
      this.writeQueues.get(dateStr)!.push({ kind: 'update', updates, resolve, reject });

      if (!this.processingKeys.has(dateStr)) {
        this.processingKeys.add(dateStr);
        this.processQueue(dateStr);
      }
    });
  }

  /**
   * Enqueue a mutation callback that receives the current day data inside the
   * sequential queue processor — safe against concurrent-write races.
   * The mutator returns partial updates to merge.
   */
  mutateDay(dateStr: string, mutator: (day: LocalDayData | null) => Partial<LocalDayData>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.writeQueues.has(dateStr)) {
        this.writeQueues.set(dateStr, []);
      }
      this.writeQueues.get(dateStr)!.push({ kind: 'mutate', mutator, resolve, reject });

      if (!this.processingKeys.has(dateStr)) {
        this.processingKeys.add(dateStr);
        this.processQueue(dateStr);
      }
    });
  }

  private async processQueue(dateStr: string): Promise<void> {
    while (true) {
      const queue = this.writeQueues.get(dateStr);
      if (!queue || queue.length === 0) {
        this.processingKeys.delete(dateStr);
        return;
      }

      const batch = queue.splice(0);

      const plainItems = batch.filter((item): item is UpdateQueueItem => item.kind === 'update');
      const mutatorItems = batch.filter((item): item is MutateQueueItem => item.kind === 'mutate');

      const mergedUpdates: Partial<LocalDayData> = plainItems.reduce(
        (acc, item) => ({ ...acc, ...item.updates }),
        {} as Partial<LocalDayData>
      );

      try {
        this.pendingWrites++;
        window.dispatchEvent(new CustomEvent(EVENTS.WRITE_START, { detail: { dateStr } }));

        const existing = this.memoryCache[dateStr] || null;
        let base: LocalDayData;
        if (existing) {
          base = existing;
        } else {
          const db = await this.getDB();
          const stored = await db.get(DB.LOGS_STORE, dateStr);
          base = stored || createEmptyDay(dateStr);
        }

        let updated: LocalDayData = { ...base, ...mergedUpdates };

        for (const item of mutatorItems) {
          const patch = item.mutator(updated);
          updated = { ...updated, ...patch };
        }

        updated.updated_at = new Date().toISOString();
        const db = await this.getDB();
        await db.put(DB.LOGS_STORE, updated, dateStr);
        this.memoryCache[dateStr] = updated;

        window.dispatchEvent(new Event(`${EVENTS.DATA_UPDATED_PREFIX}${dateStr}`));
        window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));

        batch.forEach(item => item.resolve());
      } catch (err: unknown) {
        batch.forEach(item => item.reject(err));
      } finally {
        this.pendingWrites--;
        if (this.pendingWrites < 0) this.pendingWrites = 0;
        window.dispatchEvent(new CustomEvent(EVENTS.WRITE_END, { detail: { dateStr, pending: this.pendingWrites } }));
      }
    }
  }

  async replaceAllData(data: Record<string, LocalDayData>): Promise<void> {
    await this.init();
    const db = await this.getDB();
    const tx = db.transaction(DB.LOGS_STORE, 'readwrite');
    await tx.store.clear();
    for (const [dateStr, log] of Object.entries(data)) {
      await tx.store.put(log, dateStr);
    }
    await tx.done;
    this.memoryCache = {};
    for (const [dateStr, log] of Object.entries(data)) {
      this.memoryCache[dateStr] = log;
    }
    window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
  }

  async getAllDaysInRange(startDate: string, endDate: string): Promise<LocalDayData[]> {
    await this.init();
    const db = await this.getDB();
    const range = IDBKeyRange.bound(startDate, endDate);
    const items: LocalDayData[] = [];
    let cursor = await db.transaction(DB.LOGS_STORE).store.openCursor(range);
    while (cursor) {
      items.push(cursor.value);
      cursor = await cursor.continue();
    }
    return items;
  }

  async getAllDays(): Promise<Record<string, LocalDayData>> {
    await this.init();
    const copy: Record<string, LocalDayData> = {};
    for (const [k, v] of Object.entries(this.memoryCache)) {
      copy[k] = { ...v };
    }
    return copy;
  }

  async getAllLogs(): Promise<LocalDayData[]> {
    await this.init();
    return Object.values(this.memoryCache).map(d => ({ ...d }));
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    this.settingsCache = { ...settings };
    const db = await this.getDB();
    await db.put(DB.SETTINGS_STORE, settings, 'current');
    window.dispatchEvent(new Event(EVENTS.SETTINGS_UPDATED));
  }

  async getSettings(): Promise<UserSettings | null> {
    await this.init();
    return this.settingsCache ? { ...this.settingsCache } : null;
  }

  getCachedSettings(): UserSettings | null {
    return this.settingsCache ? { ...this.settingsCache } : null;
  }

  async clearAllLogs(): Promise<void> {
    const db = await this.getDB();
    await db.clear(DB.LOGS_STORE);
    this.memoryCache = {};
    window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
  }

  async clearAll(): Promise<void> {
    await this.clearAllLogs();
    this.settingsCache = null;
    const db = await this.getDB();
    await db.clear(DB.SETTINGS_STORE);
  }

  async getStorageEstimate(): Promise<{ usage?: number; quota?: number } | null> {
    if (navigator.storage && navigator.storage.estimate) {
      return await navigator.storage.estimate();
    }
    return null;
  }

  async pruneOldData(retentionMonths: number): Promise<number> {
    if (retentionMonths <= 0) return 0;
    const cutoff = subMonths(new Date(), retentionMonths);
    const cutoffStr = format(cutoff, 'yyyy-MM-dd');
    const dates = Object.keys(this.memoryCache).filter(d => d < cutoffStr);
    if (dates.length === 0) return 0;
    const db = await this.getDB();
    const tx = db.transaction(DB.LOGS_STORE, 'readwrite');
    for (const date of dates) {
      await tx.store.delete(date);
      delete this.memoryCache[date];
    }
    await tx.done;
    window.dispatchEvent(new Event(EVENTS.DATA_UPDATED));
    return dates.length;
  }

  subscribeToSettings(callback: (settings: UserSettings | null) => void): () => void {
    const handler = () => callback(this.settingsCache ? { ...this.settingsCache } : null);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handler);
    callback(this.settingsCache ? { ...this.settingsCache } : null);
    return () => window.removeEventListener(EVENTS.SETTINGS_UPDATED, handler);
  }

  subscribeToDay(dateStr: string, callback: (data: LocalDayData) => void): () => void {
    const handler = () => {
      const data = this.memoryCache[dateStr] || createEmptyDay(dateStr);
      callback({ ...data });
    };
    const eventName = `${EVENTS.DATA_UPDATED_PREFIX}${dateStr}`;
    window.addEventListener(eventName, handler);
    handler();
    return () => window.removeEventListener(eventName, handler);
  }

  exportData(): string {
    const data = {
      settings: this.settingsCache,
      daily_logs: this.memoryCache,
    };
    return JSON.stringify(data, null, 2);
  }

  validateImport(data: any): { valid: boolean; daysCount: number; firstDate: string; lastDate: string; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, daysCount: 0, firstDate: '', lastDate: '', error: 'Invalid file format' };
    }
    const logs = data.daily_logs || data.logs;
    if (!logs || typeof logs !== 'object') {
      return { valid: false, daysCount: 0, firstDate: '', lastDate: '', error: 'No daily logs found in backup' };
    }
    const dates = Object.keys(logs).sort();
    if (dates.length === 0) {
      return { valid: false, daysCount: 0, firstDate: '', lastDate: '', error: 'Backup is empty' };
    }
    const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const TRAINING_TYPES = ['gym', 'fighting', 'cardio'];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const date of dates) {
      if (!dateRegex.test(date)) {
        return { valid: false, daysCount: 0, firstDate: '', lastDate: '', error: `Invalid date format: ${date}` };
      }
      const log = logs[date];
      if (log.prayers) {
        for (const pName of Object.keys(log.prayers)) {
          if (!PRAYER_NAMES.includes(pName)) {
            return { valid: false, daysCount: 0, firstDate: '', lastDate: '', error: `Invalid prayer name "${pName}" in log ${date}` };
          }
        }
      }
      if (Array.isArray(log.trainings)) {
        for (const training of log.trainings) {
          if (training.type && !TRAINING_TYPES.includes(training.type)) {
            return { valid: false, daysCount: 0, firstDate: '', lastDate: '', error: `Invalid training type "${training.type}" in log ${date}` };
          }
        }
      }
    }
    return {
      valid: true,
      daysCount: dates.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    };
  }

  async importData(json: string, mode: 'merge' | 'replace' = 'replace'): Promise<boolean> {
    try {
      const parsed = JSON.parse(json);
      const validation = this.validateImport(parsed);
      if (!validation.valid) throw new Error(validation.error);
      if (parsed.settings) await this.saveSettings(parsed.settings);
      const logs = parsed.daily_logs || parsed.logs;
      if (logs) {
        if (mode === 'merge') {
          for (const [date, log] of Object.entries(logs)) {
            await this.updateDay(date, log as Partial<LocalDayData>);
          }
        } else {
          await this.clearAllLogs();
          for (const [date, log] of Object.entries(logs)) {
            await this.updateDay(date, log as Partial<LocalDayData>);
          }
        }
      }
      return true;
    } catch (e: any) {
      console.error('[StorageService] Import failed:', e);
      return false;
    }
  }
}

export const storageService = new StorageService();
export { safeUUID };
