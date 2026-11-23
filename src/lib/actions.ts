import { db, uid } from './db';
import { cleanForSave, titleForTime } from './calc';
import { enqueue, syncAll } from './sync';
import type { BjjSession, RExercise, Routine, WExercise, WSet, Workout } from './types';

export async function getLive(): Promise<Workout | undefined> {
  return (await db.workouts.toArray()).find((w) => w.live);
}

async function newLive(exercises: WExercise[], routineId?: string): Promise<Workout> {
  const existing = await getLive();
  if (existing) return existing; // only one workout can be in progress
  const now = Date.now();
  const w: Workout = { id: uid(), title: '', start: now, live: true, exercises, routineId, rev: 0, updatedAt: now };
  await db.workouts.put(w);
  return w;
}

export const startEmpty = () => newLive([]);

export function routineToLive(exs: RExercise[]): WExercise[] {
  return exs.map((e) => ({
    exerciseId: e.exerciseId,
    restSec: e.restSec,
    note: e.note,
    supersetId: e.supersetId,
    sets: e.sets.map((s) => ({
      type: s.type,
      tkg: s.kg,
      treps: e.repsMode === 'range' ? s.repsMin : s.reps,
      trepsMax: e.repsMode === 'range' ? s.repsMax : undefined,
      tsecs: s.secs,
      tkm: s.km,
    })),
  }));
}

export function workoutToLive(exs: WExercise[]): WExercise[] {
  return exs.map((e) => ({
    exerciseId: e.exerciseId,
    restSec: e.restSec,
    note: e.note,
    supersetId: e.supersetId,
    sets: e.sets.map((s) => ({ type: s.type, tkg: s.kg, treps: s.reps, tsecs: s.secs, tkm: s.km })),
  }));
}

export const startFromRoutine = (r: Routine) => newLive(routineToLive(r.exercises), r.id);
export const repeatWorkout = (w: Workout) => newLive(workoutToLive(w.exercises), w.routineId);

export async function updateWorkout(id: string, fn: (w: Workout) => void) {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    fn(w);
    w.updatedAt = Date.now();
    await db.workouts.put(w);
  });
}

/** Returns false when there is no completed set (nothing is saved). */
export async function finishLive(id: string, title: string): Promise<boolean> {
  const w = await db.workouts.get(id);
  if (!w) return false;
  const exercises = cleanForSave(w.exercises);
  if (!exercises.length) return false;
  const end = w.manualEnd && w.end ? w.end : Date.now();
  const saved: Workout = {
    ...w,
    title: title.trim() || titleForTime(w.start),
    exercises,
    end,
    live: false,
    rev: w.rev + 1,
    updatedAt: Date.now(),
  };
  delete saved.live;
  await db.workouts.put(saved);
  await db.kv.delete('rest');
  await enqueue('workout', saved.id, saved.rev);
  void syncAll();
  return true;
}

export async function discardLive(id: string) {
  const w = await db.workouts.get(id);
  if (w?.live) await db.workouts.delete(id);
  await db.kv.delete('rest');
}

export async function saveEditedWorkout(w: Workout) {
  const exercises = cleanForSave(w.exercises);
  const saved = { ...w, exercises, rev: w.rev + 1, updatedAt: Date.now() };
  await db.workouts.put(saved);
  await enqueue('workout', saved.id, saved.rev);
  void syncAll();
}

export async function deleteWorkout(id: string) {
  await db.workouts.delete(id);
  await enqueue('workout', id, Date.now());
  void syncAll();
}

export async function saveBjj(b: Omit<BjjSession, 'rev' | 'updatedAt'> & { rev?: number }) {
  const prev = await db.bjj.get(b.id);
  const s: BjjSession = { ...b, rev: (prev?.rev ?? 0) + 1, updatedAt: Date.now() };
  await db.bjj.put(s);
  await enqueue('bjj', s.id, s.rev);
  void syncAll();
  return s;
}

export async function deleteBjj(id: string) {
  await db.bjj.delete(id);
  await enqueue('bjj', id, Date.now());
  void syncAll();
}

export async function sendAnswer(entryId: string, text: string) {
  const s = await db.sync.get(entryId);
  const n = (s?.answersSent ?? 0) + 1 + (await db.outbox.where('entryId').equals(entryId).filter((o) => o.kind === 'answer').count());
  await enqueue('answer', entryId, n, { answerNo: n, text });
  void syncAll();
}

/** Placeholder value of a set: target first, else the same set last time. */
export function placeholder(s: WSet, prev: WSet | undefined, key: 'kg' | 'reps' | 'secs' | 'km'): number | undefined {
  const t = { kg: s.tkg, reps: s.treps, secs: s.tsecs, km: s.tkm }[key];
  return t ?? prev?.[key];
}
