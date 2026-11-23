import { describe, expect, it } from 'vitest';
import {
  cleanForSave, completedSets, epley, estimateRoutineSecs, liveRecord, muscleSets, plates, previousSets,
  recordsIn, restOptions, titleForTime, warmupSets, weekStart, workoutVolume,
} from '../src/lib/calc';
import { seedExercises } from '../src/lib/seed';
import { filterExercises } from '../src/lib/search';
import type { Workout } from '../src/lib/types';

const lib = new Map(seedExercises().map((e) => [e.id, e]));
const BENCH = 'x-bench-press-barbell';

function w(id: string, start: number, sets: [number, number, string?][], live = false): Workout {
  return {
    id, title: id, start, end: start + 3600_000, live, rev: 1, updatedAt: start,
    exercises: [{ exerciseId: BENCH, sets: sets.map(([kg, reps, type]) => ({ kg, reps, type: (type ?? 'normal') as any, done: true })) }],
  };
}

describe('seed library (S-001)', () => {
  it('has at least 150 exercises with all fields', () => {
    const all = seedExercises();
    expect(all.length).toBeGreaterThanOrEqual(150);
    for (const e of all) {
      expect(e.name && e.equipment && e.type && e.primary).toBeTruthy();
      expect(Array.isArray(e.secondary)).toBe(true);
    }
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });
  it('sorts A to Z case-insensitive', () => {
    const names = filterExercises(seedExercises(), '').map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    expect(names).toEqual(sorted);
  });
});

describe('search (S-002)', () => {
  it('matches every word in any order', () => {
    const r = filterExercises(seedExercises(), 'press bench');
    expect(r.map((e) => e.name)).toContain('Bench Press (Barbell)');
  });
  it('combines filters with AND', () => {
    const r = filterExercises(seedExercises(), 'press', 'dumbbell', 'chest');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) => e.equipment === 'dumbbell' && (e.primary === 'chest' || e.secondary.includes('chest')))).toBe(true);
  });
});

describe('volume and save (S-005, S-007)', () => {
  it('volume is the sum of weight x reps of completed sets', () => {
    const x = w('a', 0, [[60, 10], [70, 8]]);
    x.exercises[0].sets.push({ type: 'normal', kg: 100, reps: 5, done: false });
    expect(workoutVolume(x)).toBe(60 * 10 + 70 * 8);
    expect(completedSets(x)).toBe(2);
  });
  it('drops sets that are not completed', () => {
    const exs = [{ exerciseId: BENCH, sets: [{ type: 'normal' as const, kg: 1, reps: 1, done: true }, { type: 'normal' as const }] }];
    expect(cleanForSave(exs)[0].sets.length).toBe(1);
    expect(cleanForSave([{ exerciseId: BENCH, sets: [{ type: 'normal' }] }]).length).toBe(0);
  });
  it('titles by time of day', () => {
    expect(titleForTime(new Date(2026, 0, 1, 8).getTime())).toBe('אימון בוקר');
    expect(titleForTime(new Date(2026, 0, 1, 14).getTime())).toBe('אימון צהריים');
    expect(titleForTime(new Date(2026, 0, 1, 20).getTime())).toBe('אימון ערב');
  });
});

describe('records (S-023, S-038)', () => {
  it('Epley: 1 rep returns the weight', () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 10)).toBeCloseTo(133.33, 1);
  });
  it('first ever workout sets no records', () => {
    const a = w('a', 1, [[60, 10]]);
    expect(recordsIn(a, [a]).size).toBe(0);
  });
  it('finds heavier weight and more reps, ignores warm-ups', () => {
    const a = w('a', 1, [[60, 10]]);
    const b = w('b', 2, [[200, 1, 'warmup'], [65, 10]]);
    const r = recordsIn(b, [a, b]);
    expect(r.has('0:0')).toBe(false);
    expect(r.get('0:1')).toEqual(expect.arrayContaining(['weight', 'e1rm', 'volume']));
  });
  it('live record compares with history and earlier sets', () => {
    const a = w('a', 1, [[60, 10]]);
    const cur = w('c', 2, [[70, 5], [70, 5]]).exercises[0];
    expect(liveRecord(BENCH, cur.sets[0], [a], cur)).toContain('weight');
    // second identical set is not a new record over the first
    expect(liveRecord(BENCH, cur.sets[1], [a], { ...cur, sets: [cur.sets[0], cur.sets[1]] }).includes('weight')).toBe(false);
  });
});

describe('muscles (S-017)', () => {
  it('primary 1, secondary 0.5', () => {
    const m = new Map(muscleSets([{ exerciseId: BENCH, sets: 1 }], lib));
    expect(m.get('chest')).toBe(1);
    expect(m.get('shoulders')).toBe(0.5);
    expect(m.get('triceps')).toBe(0.5);
  });
  it('estimates duration from work and rest', () => {
    expect(estimateRoutineSecs([{ exerciseId: BENCH, restSec: 60, sets: [{ type: 'normal' }, { type: 'normal' }] }])).toBe(200);
  });
});

describe('rest options (S-014)', () => {
  it('Off, 5 s steps to 2:00, 15 s steps to 5:00', () => {
    const o = restOptions();
    expect(o[0]).toBe(0);
    expect(o).toContain(120);
    expect(o).toContain(135);
    expect(o).not.toContain(125);
    expect(o[o.length - 1]).toBe(300);
  });
});

describe('calculators (S-035, S-036)', () => {
  it('100 kg on a 20 kg bar is 25 + 15 per side', () => {
    expect(plates(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).perSide).toEqual([25, 15]);
  });
  it('impossible weight gives the nearest it can make', () => {
    const r = plates(101, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(r.achieved).toBe(100);
  });
  it('warm-up 40/60/80 rounded to 2.5', () => {
    const s = warmupSets(100, [{ pct: 40, reps: 10 }, { pct: 60, reps: 5 }, { pct: 80, reps: 3 }]);
    expect(s.map((x) => [x.kg, x.reps])).toEqual([[40, 10], [60, 5], [80, 3]]);
    expect(warmupSets(85, [{ pct: 40, reps: 10 }])[0].kg).toBe(35);
  });
});

describe('previous values (S-028)', () => {
  it('uses the most recent saved workout with the exercise', () => {
    const a = w('a', 1, [[50, 10]]);
    const b = w('b', 2, [[55, 9]]);
    const live = w('c', 3, [[0, 0]], true);
    expect(previousSets(BENCH, [a, b, live])[0].kg).toBe(55);
  });
});

describe('weeks (S-029)', () => {
  it('weeks start on Sunday by default', () => {
    const wed = new Date(2026, 10, 25, 15).getTime(); // Wednesday
    expect(new Date(weekStart(wed, 0)).getDay()).toBe(0);
    expect(new Date(weekStart(wed, 1)).getDay()).toBe(1);
  });
});
