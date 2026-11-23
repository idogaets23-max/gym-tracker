export type Equipment =
  | 'none' | 'barbell' | 'dumbbell' | 'kettlebell' | 'machine'
  | 'plate' | 'band' | 'suspension' | 'cable' | 'other';

export type ExerciseType =
  | 'weight_reps' | 'reps_only' | 'weighted_bodyweight' | 'assisted_bodyweight'
  | 'duration' | 'weight_duration' | 'distance_duration' | 'weight_distance';

export type Muscle =
  | 'abdominals' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quadriceps'
  | 'hamstrings' | 'calves' | 'glutes' | 'abductors' | 'adductors' | 'lats'
  | 'upper_back' | 'traps' | 'lower_back' | 'chest' | 'cardio' | 'neck'
  | 'full_body' | 'other';

export type SetType = 'warmup' | 'normal' | 'failure' | 'drop';

export interface Exercise {
  id: string;
  name: string;
  equipment: Equipment;
  type: ExerciseType;
  primary: Muscle;
  secondary: Muscle[];
  custom?: boolean;
  note?: string; // pinned note
  howto?: string[];
}

export interface WSet {
  type: SetType;
  kg?: number;
  reps?: number;
  secs?: number;
  km?: number;
  rpe?: number;
  done?: boolean;
  /** targets from a routine or a repeated workout, shown as placeholders */
  tkg?: number;
  treps?: number;
  trepsMax?: number;
  tsecs?: number;
  tkm?: number;
}

export interface WExercise {
  exerciseId: string;
  restSec?: number;
  note?: string;
  supersetId?: string;
  sets: WSet[];
}

export interface Workout {
  id: string;
  title: string;
  start: number; // ms
  end?: number; // ms, set when finished
  routineId?: string;
  live?: boolean;
  /** true when the user set the duration by hand; finishing keeps `end` */
  manualEnd?: boolean;
  exercises: WExercise[];
  rev: number;
  updatedAt: number;
}

export type BjjType = 'gi' | 'nogi' | 'openmat' | 'competition';

export interface BjjSession {
  id: string;
  start: number;
  type: BjjType;
  minutes: number;
  intensity: number;
  summary: string;
  rev: number;
  updatedAt: number;
}

export interface RSet {
  type: SetType;
  kg?: number;
  reps?: number;
  repsMin?: number;
  repsMax?: number;
  secs?: number;
  km?: number;
}

export interface RExercise {
  exerciseId: string;
  restSec?: number;
  note?: string;
  supersetId?: string;
  repsMode?: 'reps' | 'range';
  sets: RSet[];
}

export interface Routine {
  id: string;
  title: string;
  folderId?: string;
  order: number;
  exercises: RExercise[];
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
  collapsed?: boolean;
}

export interface BodyWeight {
  date: string; // YYYY-MM-DD
  kg: number;
}

export type EntryKind = 'workout' | 'bjj';

export interface OutboxItem {
  seq?: number;
  kind: EntryKind | 'answer';
  entryId: string;
  rev: number;
  answerNo?: number;
  text?: string;
  createdAt: number;
  tries: number;
  nextTry: number;
}

export interface EntrySync {
  entryId: string;
  status: 'waiting' | 'sent' | 'read';
  sentRev?: number;
  reply?: string;
  replySha?: string;
  replySeen?: boolean;
  answersSent?: number;
}

export interface Prep {
  name: string; // file name YYYY-MM-DD-HHMM.md
  sha: string;
  text: string;
}

export interface Settings {
  units: 'kg' | 'lb';
  defaultRestSec: number;
  sound: boolean;
  rpe: boolean;
  warmupRule: { pct: number; reps: number }[];
  barKg: number;
  plates: number[];
  liveRecords: boolean;
  weekStart: 0 | 1; // 0 Sunday, 1 Monday
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'kg',
  defaultRestSec: 90,
  sound: true,
  rpe: false,
  warmupRule: [
    { pct: 40, reps: 10 },
    { pct: 60, reps: 5 },
    { pct: 80, reps: 3 },
  ],
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  liveRecords: true,
  weekStart: 0,
};
