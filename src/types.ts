export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PrayerStatus = 'prayed' | 'missed' | 'pending' | 'qada';
export type TrainingType = 'gym' | 'fighting' | 'cardio';
export interface PrayerLog {
  id?: string;
  name: PrayerName;
  status: PrayerStatus;
  delay_minutes: number;
  sunnah_flag: boolean;
  on_time: boolean;
  actual_time: string | null;
  target_time: string | null;
}

export interface RelapseEvent {
  id?: string;
  timestamp: string;
  edited_at?: string;
}

export interface TrainingLog {
  id?: string;
  type: TrainingType;
  timestamp: string;
  note: string;
  is_pr?: boolean;
  pr_details?: string;
}

export interface DailyLog {
  date: string;
  total_screen_minutes: number;
  updated_at: string;
  qada_count?: number;
}

export interface AppUsage {
  appName: string;
  minutes: number;
  packageName?: string;
}

export interface UserSettings {
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  prayer_reminder_offset: number;
  /** Hour (0-23) when the behavioral day rolls over. Default 3 (3AM). */
  day_boundary_hour?: number;
  /** Number of months to retain data. 0 = unlimited. Default 0. */
  retention_months?: number;
  /** Daily relapse target. 0 = no target. Default 0. */
  relapse_daily_target?: number;
  /** Daily screen time target in minutes. Default 60. */
  screen_time_target?: number;
  /** First day of week: 0=Sunday, 1=Monday, ..., 6=Saturday. Default 6. */
  firstWeekday?: number;
}


