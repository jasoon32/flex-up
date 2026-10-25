import type { SessionSet, WeightUnit } from './types';

export interface Suggestion {
  /** Weight to use in the exercise's unit; null for bodyweight. */
  weight: number | null;
  reps: number;
  /** 'weight': every set reached the top of the range, so go heavier. 'reps': same weight, one more rep. */
  kind: 'weight' | 'reps';
}

/**
 * Double progression, as most coaches and tracker apps teach it: keep the weight until every
 * working set reaches the top of the rep range, then add one step and start again at the bottom.
 * Without a range, the single target counts as both ends. Bodyweight moves add reps instead.
 */
export function suggestNext(
  last: SessionSet[],
  range: { min: number; max: number } | null,
  unit: WeightUnit,
  step: number,
): Suggestion | null {
  const working = last.filter((s) => s.completed && s.set_type !== 'warmup' && s.reps !== null);
  if (working.length === 0) return null;
  // The heaviest weight used decides; lighter back-off sets don't hold it back.
  const top = Math.max(...working.map((s) => s.weight ?? 0));
  const topSets = working.filter((s) => (s.weight ?? 0) === top);
  const fewest = Math.min(...topSets.map((s) => s.reps!));
  const min = range?.min ?? fewest;
  const max = range?.max ?? range?.min ?? fewest;

  if (unit === 'bw' && top === 0) {
    // Plain bodyweight: there is no weight to add, so aim for one more rep each time.
    return { weight: null, reps: fewest + 1, kind: 'reps' };
  }
  if (fewest >= max) {
    return { weight: Math.round((top + step) * 100) / 100, reps: min, kind: 'weight' };
  }
  return { weight: top || null, reps: Math.min(max, fewest + 1), kind: 'reps' };
}
