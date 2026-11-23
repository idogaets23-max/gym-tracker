import type { Equipment, Exercise, Muscle } from './types';

/** Every word must appear in the name, in any order, case-insensitive. Filters combine with AND. */
export function filterExercises(
  list: Exercise[],
  q: string,
  equipment: Equipment | 'all' = 'all',
  muscle: Muscle | 'all' = 'all',
): Exercise[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((e) => equipment === 'all' || e.equipment === equipment)
    .filter((e) => muscle === 'all' || e.primary === muscle || e.secondary.includes(muscle))
    .filter((e) => {
      const n = e.name.toLowerCase();
      return words.every((w) => n.includes(w));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
