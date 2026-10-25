import type { SessionSet, SetType, WeightUnit } from './types';

export const LB_TO_KG = 0.45359237;
export const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb', 'bw'];

/** Step sizes for the − / + buttons, per unit. Bodyweight steps are added kg. */
export const UNIT_STEPS: Record<WeightUnit, readonly number[]> = {
  kg: [1.25, 2.5, 5, 10],
  lb: [2.5, 5, 10, 25],
  bw: [1.25, 2.5, 5, 10],
};

/** The unit the number is actually in: added weight on a bodyweight exercise is kg. */
const massUnit = (u: WeightUnit) => (u === 'lb' ? 'lb' : 'kg');

export const toKg = (weight: number, unit: WeightUnit) => (unit === 'lb' ? weight * LB_TO_KG : weight);

/** 95 lb → 43.1 kg. Blank stays blank; same-mass switches (kg ↔ bw) keep the number. */
export function convertWeight(weight: number | null, from: WeightUnit, to: WeightUnit): number | null {
  if (weight === null || massUnit(from) === massUnit(to)) return weight;
  const value = massUnit(to) === 'kg' ? weight * LB_TO_KG : weight / LB_TO_KG;
  return Math.round(value * 10) / 10;
}

/** kg moved in one set, counting both hands on per-hand lifts. Warm-ups don't count. */
export const setVolumeKg = (
  s: Pick<SessionSet, 'weight' | 'reps' | 'weight_unit' | 'per_side'> & Partial<Pick<SessionSet, 'set_type'>>,
) => (s.set_type === 'warmup' ? 0 : toKg(s.weight ?? 0, s.weight_unit) * (s.reps ?? 0) * (s.per_side ? 2 : 1));

export const asSetType = (v: unknown): SetType =>
  v === 'warmup' || v === 'drop' || v === 'failure' ? v : 'normal';

/** Column header and input label: "kg", "lb", or "+kg" for added weight on bodyweight. */
export const unitLabel = (u: WeightUnit) => (u === 'bw' ? '+kg' : u);

export const nextUnit = (u: WeightUnit): WeightUnit => WEIGHT_UNITS[(WEIGHT_UNITS.indexOf(u) + 1) % WEIGHT_UNITS.length];

export const asUnit = (v: unknown): WeightUnit => (v === 'lb' || v === 'bw' ? v : 'kg');
