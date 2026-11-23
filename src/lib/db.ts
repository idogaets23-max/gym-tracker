import Dexie, { type Table } from 'dexie';
import type {
  BjjSession, BodyWeight, EntrySync, Exercise, Folder, OutboxItem, Prep, Routine, Settings, Workout,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import { seedExercises } from './seed';

export interface KV { key: string; value: unknown }

export class GymDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  bjj!: Table<BjjSession, string>;
  routines!: Table<Routine, string>;
  folders!: Table<Folder, string>;
  bodyweight!: Table<BodyWeight, string>;
  kv!: Table<KV, string>;
  outbox!: Table<OutboxItem, number>;
  sync!: Table<EntrySync, string>;
  prep!: Table<Prep, string>;

  constructor(name = 'gym-tracker') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, primary, equipment',
      workouts: 'id, start, live',
      bjj: 'id, start',
      routines: 'id, folderId, order',
      folders: 'id, order',
      bodyweight: 'date',
      kv: 'key',
      outbox: '++seq, entryId, nextTry',
      sync: 'entryId',
      prep: 'name',
    });
  }
}

export let db = new GymDB();

/** For tests: use a fresh database. */
export function useDb(d: GymDB) {
  db = d;
}

export async function ensureSeed(d: GymDB = db) {
  const done = await d.kv.get('seeded');
  if (done) return;
  await d.exercises.bulkPut(seedExercises());
  await d.kv.put({ key: 'seeded', value: 1 });
}

export async function getSettings(d: GymDB = db): Promise<Settings> {
  const r = await d.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((r?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings, d: GymDB = db) {
  await d.kv.put({ key: 'settings', value: s });
}

export const uid = () =>
  Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
