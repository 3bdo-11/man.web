import { PrayerLog, TrainingLog, UserSettings, DailyLog, RelapseEvent } from '../types.ts';
import { MANDATORY_PRAYERS } from './adhan.ts';

function scoreSinglePrayer(prayer?: PrayerLog): number {
  if (!prayer) return 0;

  switch (prayer.status) {
    case 'prayed':
      if (prayer.on_time) {
        return prayer.sunnah_flag ? 10 : 9;
      }
      return 5;
    case 'qada':
      return prayer.on_time ? 6 : 3;
    case 'missed':
      return -10;
    default:
      return 0;
  }
}

function calculateRelapseScore(actual: number, target: number): number {
  const a = Number.isFinite(actual) ? Math.max(0, actual) : 0;
  const t = Number.isFinite(target) ? Math.max(0, target) : 0;
  if (t <= 0 && a === 0) return 30;
  if (t <= 0) return Math.max(-60, -a * 10);
  if (a === 0) return 30;
  if (a <= t) {
    return Math.round(30 * (1 - a / t));
  }
  return Math.max(-60, -(a - t) * 10);
}

function calculateTrainingScore(trainings: TrainingLog[]): number {
  if (trainings.length === 0) return 0;
  const types = new Set(trainings.map(t => t.type));
  let score = 0;
  if (types.has('gym')) score += 3;
  if (types.has('cardio')) score += 3;
  if (types.has('fighting')) score += 3;
  const sessionBonus = Math.min(trainings.length - types.size, 6);
  score += sessionBonus;
  return Math.min(score, 15);
}

function calculateScreenTimeScore(actualMinutes: number, targetMinutes: number): number {
  const actual = Number.isFinite(actualMinutes) ? Math.max(0, actualMinutes) : 0;
  const target = Number.isFinite(targetMinutes) ? Math.max(0, targetMinutes) : 60;
  if (actual <= target) return 5;
  const minutesOver = actual - target;
  return Math.max(-30, -Math.round((minutesOver / Math.max(1, target)) * 15));
}

export function calculateDailyScore(
  log: DailyLog,
  prayers: PrayerLog[],
  trainings: TrainingLog[],
  relapses: RelapseEvent[],
  settings: UserSettings | null,
): { total: number; prayer: number; relapse: number; training: number; screenTime: number } {
  const prayerMap = new Map(prayers.map(p => [p.name, p]));
  const prayerScore = MANDATORY_PRAYERS.reduce((total, name) => total + scoreSinglePrayer(prayerMap.get(name)), 0);

  const relapseTarget = settings?.relapse_daily_target ?? 2;
  const relapseScore = calculateRelapseScore(relapses.length, relapseTarget);

  const trainingScore = calculateTrainingScore(trainings);

  const screenTimeTarget = settings?.screen_time_target ?? 60;
  const rawScreen = log.total_screen_minutes || 0;
  const screenTimeScore = calculateScreenTimeScore(rawScreen, screenTimeTarget);

  const total = Math.max(-100, Math.min(100, prayerScore + relapseScore + trainingScore + screenTimeScore));

  return { total, prayer: prayerScore, relapse: relapseScore, training: trainingScore, screenTime: screenTimeScore };
}

export function getScoreInterpretation(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 20) return 'Average';
  if (score >= 0) return 'Poor';
  return 'Critical';
}

export function getScoreLevel(score: number): 'high' | 'mid' | 'low' | 'critical' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  if (score >= 0) return 'low';
  return 'critical';
}
