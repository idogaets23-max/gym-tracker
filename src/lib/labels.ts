import type { BjjType, Equipment, ExerciseType, Muscle, SetType } from './types';

export const EQUIPMENT: Record<Equipment, string> = {
  none: 'בלי ציוד',
  barbell: 'מוט',
  dumbbell: 'משקולות יד',
  kettlebell: 'קטלבל',
  machine: 'מכונה',
  cable: 'כבל',
  plate: 'צלחת',
  band: 'גומייה',
  suspension: 'רצועות TRX',
  other: 'אחר',
};

/** Short English tag shown in parentheses after the exercise name. */
export const EQUIPMENT_TAG: Record<Equipment, string> = {
  none: '',
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Cable',
  plate: 'Plate',
  band: 'Band',
  suspension: 'Suspension',
  other: 'Other',
};

export const MUSCLE: Record<Muscle, string> = {
  abdominals: 'בטן',
  shoulders: 'כתפיים',
  biceps: 'יד קדמית',
  triceps: 'יד אחורית',
  forearms: 'אמות',
  quadriceps: 'ארבע ראשי',
  hamstrings: 'המסטרינג',
  calves: 'תאומים',
  glutes: 'ישבן',
  abductors: 'מרחיקים',
  adductors: 'מקרבים',
  lats: 'רחב גבי',
  upper_back: 'גב עליון',
  traps: 'טרפז',
  lower_back: 'גב תחתון',
  chest: 'חזה',
  cardio: 'אירובי',
  neck: 'צוואר',
  full_body: 'כל הגוף',
  other: 'אחר',
};

export const EXERCISE_TYPE: Record<ExerciseType, string> = {
  weight_reps: 'משקל וחזרות',
  reps_only: 'חזרות בלבד',
  weighted_bodyweight: 'משקל גוף + תוספת',
  assisted_bodyweight: 'משקל גוף בעזרה',
  duration: 'זמן',
  weight_duration: 'משקל וזמן',
  distance_duration: 'מרחק וזמן',
  weight_distance: 'משקל ומרחק',
};

export const SET_TYPE: Record<SetType, { letter: string; label: string; color: string }> = {
  warmup: { letter: 'W', label: 'חימום', color: 'var(--orange)' },
  normal: { letter: '', label: 'רגיל', color: 'var(--text)' },
  failure: { letter: 'F', label: 'עד כשל', color: 'var(--red)' },
  drop: { letter: 'D', label: 'דרופ', color: 'var(--blue)' },
};

export const BJJ_TYPE: Record<BjjType, string> = {
  gi: 'גי',
  nogi: 'נו־גי',
  openmat: 'אופן מאט',
  competition: 'תחרות',
};

/** Which input columns a set has, by exercise type. */
export function columnsFor(t: ExerciseType): ('kg' | 'reps' | 'secs' | 'km')[] {
  switch (t) {
    case 'weight_reps':
    case 'weighted_bodyweight':
    case 'assisted_bodyweight':
      return ['kg', 'reps'];
    case 'reps_only':
      return ['reps'];
    case 'duration':
      return ['secs'];
    case 'weight_duration':
      return ['kg', 'secs'];
    case 'distance_duration':
      return ['km', 'secs'];
    case 'weight_distance':
      return ['kg', 'km'];
  }
}

export const COLUMN_LABEL = { kg: 'ק"ג', reps: 'חזרות', secs: 'זמן', km: 'ק"מ' } as const;
