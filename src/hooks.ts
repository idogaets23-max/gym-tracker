import { useEffect, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';
import { db, getSettings } from './lib/db';
import { DEFAULT_SETTINGS, type Settings } from './lib/types';

export function useLive<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({ next: setV, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => setR(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function nav(path: string, replace = false) {
  const h = '#/' + path.replace(/^\//, '');
  if (replace) location.replace(h);
  else location.hash = h;
  scrollTo(0, 0);
}

export function back(fallback = '') {
  if (history.length > 1) history.back();
  else nav(fallback);
}

export function useSettings(): Settings {
  return useLive(() => getSettings(), []) ?? DEFAULT_SETTINGS;
}

export function useNow(ms = 1000): number {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export function useExerciseMap() {
  return useLive(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
}

const LB = 2.20462;
export function useUnits() {
  const s = useSettings();
  const lb = s.units === 'lb';
  return {
    label: lb ? 'lb' : 'ק"ג',
    /** kg -> shown number */
    show: (kg?: number) => (kg == null ? undefined : lb ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 100) / 100),
    /** shown number -> kg */
    toKg: (v?: number) => (v == null || isNaN(v) ? undefined : lb ? Math.round((v / LB) * 1000) / 1000 : v),
  };
}
