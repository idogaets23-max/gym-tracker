import type { Exercise, Muscle, RExercise, WExercise, WSet, Workout } from './types';

export const round = (n: number, step = 0.01) => Math.round(n / step) * step;

/** Estimated 1RM, Epley. One rep returns the weight. */
export function epley(kg: number, reps: number): number {
  if (!kg || !reps) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}

export const isWorkSet = (s: WSet) => s.done && s.type !== 'warmup';

export function setVolume(s: WSet): number {
  return (s.kg ?? 0) * (s.reps ?? 0);
}

/** Volume of completed sets (weight x reps). Warm-ups count, like the reference. */
export function workoutVolume(w: Pick<Workout, 'exercises'>): number {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done) v += setVolume(s);
  return round(v, 0.01);
}

export function completedSets(w: Pick<Workout, 'exercises'>): number {
  let n = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done) n++;
  return n;
}

export function workoutReps(w: Pick<Workout, 'exercises'>): number {
  let n = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done) n += s.reps ?? 0;
  return n;
}

export function titleForTime(ms: number): string {
  const h = new Date(ms).getHours();
  if (h >= 5 && h < 12) return 'אימון בוקר';
  if (h >= 12 && h < 17) return 'אימון צהריים';
  return 'אימון ערב';
}

/** Drop sets that are not completed, and exercises left with none. */
export function cleanForSave(exs: WExercise[]): WExercise[] {
  return exs
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0);
}

// ---------- records ----------

export type RecordKind = 'weight' | 'e1rm' | 'volume' | 'reps' | 'duration';
export const RECORD_LABEL: Record<RecordKind, string> = {
  weight: 'משקל הכי כבד',
  e1rm: '1RM משוער',
  volume: 'נפח סט',
  reps: 'הכי הרבה חזרות',
  duration: 'הכי הרבה זמן',
};

export interface Best { weight: number; e1rm: number; volume: number; reps: number; duration: number }
const ZERO: Best = { weight: 0, e1rm: 0, volume: 0, reps: 0, duration: 0 };

function setMetrics(s: WSet): Best {
  return {
    weight: s.kg ?? 0,
    e1rm: epley(s.kg ?? 0, s.reps ?? 0),
    volume: setVolume(s),
    reps: s.reps ?? 0,
    duration: s.secs ?? 0,
  };
}

/** Best values of one exercise over a list of workouts (completed, non-warm-up sets). */
export function bestFor(exerciseId: string, workouts: Workout[]): Best {
  const b = { ...ZERO };
  for (const w of workouts)
    for (const e of w.exercises)
      if (e.exerciseId === exerciseId)
        for (const s of e.sets)
          if (isWorkSet(s)) {
            const m = setMetrics(s);
            (Object.keys(b) as RecordKind[]).forEach((k) => (b[k] = Math.max(b[k], m[k])));
          }
  return b;
}

function hasHistory(exerciseId: string, workouts: Workout[]): boolean {
  return workouts.some((w) => w.exercises.some((e) => e.exerciseId === exerciseId && e.sets.some(isWorkSet)));
}

/**
 * Records set inside `w`, compared with all earlier workouts.
 * Returns a map "exIndex:setIndex" -> kinds. The first ever workout of an exercise sets no records.
 */
export function recordsIn(w: Workout, earlier: Workout[]): Map<string, RecordKind[]> {
  const out = new Map<string, RecordKind[]>();
  const prev = earlier.filter((x) => x.id !== w.id && x.start < w.start && !x.live);
  w.exercises.forEach((e, ei) => {
    if (!hasHistory(e.exerciseId, prev)) return;
    const best = bestFor(e.exerciseId, prev);
    e.sets.forEach((s, si) => {
      if (!isWorkSet(s)) return;
      const m = setMetrics(s);
      const kinds = (Object.keys(best) as RecordKind[]).filter((k) => m[k] > 0 && m[k] > best[k] + 1e-9);
      if (kinds.length) {
        out.set(`${ei}:${si}`, kinds);
        kinds.forEach((k) => (best[k] = m[k]));
      }
    });
  });
  return out;
}

export function recordCount(w: Workout, all: Workout[]): number {
  let n = 0;
  recordsIn(w, all).forEach((k) => (n += k.length));
  return n;
}

/** Would this one set (just completed) be a record against history and the earlier sets of this workout? */
export function liveRecord(exerciseId: string, set: WSet, history: Workout[], current: WExercise): RecordKind[] {
  if (!isWorkSet(set)) return [];
  if (!hasHistory(exerciseId, history)) return [];
  const best = bestFor(exerciseId, history);
  const idx = current.sets.indexOf(set);
  for (const s of current.sets.slice(0, idx < 0 ? current.sets.length : idx)) {
    if (!isWorkSet(s)) continue;
    const m = setMetrics(s);
    (Object.keys(best) as RecordKind[]).forEach((k) => (best[k] = Math.max(best[k], m[k])));
  }
  const m = setMetrics(set);
  return (Object.keys(best) as RecordKind[]).filter((k) => m[k] > 0 && m[k] > best[k] + 1e-9);
}

// ---------- muscles ----------

/** Primary muscle counts 1 per set, each secondary 0.5. */
export function muscleSets(
  items: { exerciseId: string; sets: number }[],
  lib: Map<string, Exercise>,
): [Muscle, number][] {
  const m = new Map<Muscle, number>();
  for (const it of items) {
    const ex = lib.get(it.exerciseId);
    if (!ex || !it.sets) continue;
    m.set(ex.primary, (m.get(ex.primary) ?? 0) + it.sets);
    for (const s of ex.secondary) m.set(s, (m.get(s) ?? 0) + it.sets * 0.5);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Estimated routine duration in seconds: each set about 40 s of work plus that exercise's rest. */
export function estimateRoutineSecs(exs: RExercise[], defaultRest = 0): number {
  let t = 0;
  for (const e of exs) for (const _ of e.sets) t += 40 + (e.restSec ?? defaultRest);
  return t;
}

// ---------- plates and warm-up ----------

/** Plates per side for a barbell weight. If impossible, returns the nearest weight it can make (not above). */
export function plates(total: number, bar: number, available: number[]): { perSide: number[]; achieved: number } {
  const sorted = [...available].sort((a, b) => b - a);
  let side = round((total - bar) / 2, 0.001);
  const perSide: number[] = [];
  if (side < 0) return { perSide, achieved: bar };
  for (const p of sorted) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side = round(side - p, 0.001);
    }
  }
  const achieved = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, achieved: round(achieved, 0.01) };
}

export function warmupSets(workKg: number, rule: { pct: number; reps: number }[], step = 2.5): WSet[] {
  return rule.map((r) => ({ type: 'warmup', kg: round((workKg * r.pct) / 100, step), reps: r.reps }));
}

// ---------- previous values ----------

/** Sets of the most recent saved workout that has this exercise. */
export function previousSets(exerciseId: string, workouts: Workout[], beforeMs = Infinity): WSet[] {
  const sorted = workouts.filter((w) => !w.live && w.start < beforeMs).sort((a, b) => b.start - a.start);
  for (const w of sorted) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length) return e.sets;
  }
  return [];
}

// ---------- weeks ----------

export function weekStart(ms: number, startDay: 0 | 1): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDuration(secs: number): string {
  secs = Math.max(0, Math.round(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h) return `${h}ש' ${m}ד'`;
  return `${m}ד'`;
}

export function fmtClock(secs: number): string {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function fmtRest(secs?: number): string {
  if (!secs) return 'כבוי';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? (s ? `${m}:${String(s).padStart(2, '0')}` : `${m}:00`) : `0:${String(s).padStart(2, '0')}`;
}

/** Rest options: Off, every 5 s to 2:00, then every 15 s to 5:00. */
export function restOptions(): number[] {
  const o = [0];
  for (let s = 5; s <= 120; s += 5) o.push(s);
  for (let s = 135; s <= 300; s += 15) o.push(s);
  return o;
}
