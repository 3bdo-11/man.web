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
      return 3;
    case 'missed':
      return -10;
    default:
      return 0;
  }
}

function calculateRelapseScore(actual: number, target: number): number {
  if (target <= 0) return 0;
  if (actual === 0) return 30;
  if (actual <= target) {
    return Math.round(30 * (1 - actual / target));
  }
  return -(actual - target) * 10;
}

function calculateTrainingScore(trainings: TrainingLog[]): number {
  const types = new Set(trainings.map(t => t.type));
  let score = 0;
  if (types.has('gym')) score += 5;
  if (types.has('cardio')) score += 5;
  if (types.has('fighting')) score += 5;
  return Math.min(score, 15);
}

function calculateScreenTimeScore(actualMinutes: number, targetMinutes: number): number {
  if (actualMinutes <= targetMinutes) return 5;
  const hoursOver = Math.floor((actualMinutes - targetMinutes) / 60);
  return -5 * hoursOver;
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

  const total = prayerScore + relapseScore + trainingScore + screenTimeScore;

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
