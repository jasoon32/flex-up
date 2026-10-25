import { asUnit } from './units';
import type { DayOfWeek, DraftExercise, PlanWithExercises } from './types';

/** Where shared plan links open. */
export const APP_URL = 'https://flex-up--next.expo.app';

export interface SharedPlan {
  name: string;
  days: DayOfWeek[];
  exercises: DraftExercise[];
}

/** [name, sets, reps, reps max, rest, unit, per hand] keeps links short. */
type Row = [string, number, number, number | null, number | null, string, 0 | 1];

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** A link that carries the whole plan, so a friend can add it without any server lookup. */
export function planLink(plan: PlanWithExercises): string {
  const rows: Row[] = plan.exercises.map((e) => [
    e.name,
    e.target_sets,
    e.target_reps,
    e.target_reps_max,
    e.rest_seconds,
    e.weight_unit,
    e.per_side ? 1 : 0,
  ]);
  const json = JSON.stringify({ n: plan.name, d: plan.days, e: rows });
  return `${APP_URL}/import-plan?d=${toBase64Url(new TextEncoder().encode(json))}`;
}

const int = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Reads a shared plan back, checking every value so a damaged link can't save nonsense. */
export function readPlanLink(data: string): SharedPlan | null {
  try {
    const raw = JSON.parse(new TextDecoder().decode(fromBase64Url(data)));
    const name = typeof raw.n === 'string' ? raw.n.trim().slice(0, 60) : '';
    if (!name || !Array.isArray(raw.e) || raw.e.length === 0 || raw.e.length > 40) return null;
    const days = (Array.isArray(raw.d) ? raw.d : []).filter((d: unknown) => int(d, 0, 6) !== null) as DayOfWeek[];
    const exercises: DraftExercise[] = [];
    for (const r of raw.e as unknown[]) {
      if (!Array.isArray(r)) return null;
      const [n, sets, reps, max, rest, unit, side] = r;
      const exName = typeof n === 'string' ? n.trim().slice(0, 60) : '';
      if (!exName || int(sets, 1, 20) === null || int(reps, 1, 100) === null) return null;
      exercises.push({
        name: exName,
        target_sets: sets,
        target_reps: reps,
        target_reps_max: int(max, 1, 100),
        target_weight: null,
        rest_seconds: int(rest, 10, 600),
        weight_unit: asUnit(unit),
        per_side: side === 1,
      });
    }
    return { name, days: [...new Set(days)], exercises };
  } catch {
    return null;
  }
}
