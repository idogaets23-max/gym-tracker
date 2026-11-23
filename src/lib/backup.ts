import { db } from './db';

const TABLES = ['exercises', 'workouts', 'bjj', 'routines', 'folders', 'bodyweight'] as const;

export async function exportData(): Promise<string> {
  const out: Record<string, unknown> = { app: 'gym-tracker', version: 1, exportedAt: new Date().toISOString() };
  for (const t of TABLES) out[t] = await (db as any)[t].toArray();
  const settings = await db.kv.get('settings');
  out.settings = settings?.value ?? null;
  return JSON.stringify(out, null, 2);
}

/** Replaces all data with the file's content. A broken file throws and changes nothing. */
export async function importData(json: string): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('הקובץ אינו JSON תקין.');
  }
  if (!data || data.app !== 'gym-tracker' || !TABLES.every((t) => Array.isArray(data[t]))) {
    throw new Error('זה לא קובץ גיבוי של האפליקציה.');
  }
  const tables = TABLES.map((t) => (db as any)[t]);
  await db.transaction('rw', [...tables, db.kv], async () => {
    for (const t of TABLES) {
      await (db as any)[t].clear();
      await (db as any)[t].bulkPut(data[t]);
    }
    if (data.settings) await db.kv.put({ key: 'settings', value: data.settings });
    await db.kv.put({ key: 'seeded', value: 1 });
  });
}
