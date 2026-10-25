import type { Gender } from './character';

/**
 * Estimated one-rep max (Epley): what you could lift once, from a set of `reps`. Sets above
 * 12 reps say little about a max, so they don't count.
 */
export function e1rm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export const STRENGTH_LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'] as const;
export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

/**
 * One-rep max as a multiple of body weight where each level starts, after the widely used
 * strength-standard tables (rounded). Only the big barbell lifts have standards.
 */
const STANDARDS: Record<string, Record<Gender, [number, number, number, number, number]>> = {
  'Barbell Bench Press': { M: [0.5, 0.75, 1, 1.5, 2], F: [0.25, 0.5, 0.75, 1, 1.5] },
  'Back Squat': { M: [0.75, 1.25, 1.5, 2.25, 2.75], F: [0.5, 0.75, 1.25, 1.5, 2] },
  Deadlift: { M: [1, 1.5, 2, 2.5, 3], F: [0.5, 1, 1.25, 1.75, 2.5] },
  'Overhead Press': { M: [0.35, 0.55, 0.8, 1.05, 1.35], F: [0.2, 0.35, 0.5, 0.75, 1] },
  'Barbell Row': { M: [0.5, 0.75, 1, 1.5, 1.75], F: [0.25, 0.4, 0.65, 0.9, 1.2] },
  'Front Squat': { M: [0.6, 1, 1.25, 1.75, 2.25], F: [0.4, 0.6, 1, 1.25, 1.6] },
  'Barbell Hip Thrust': { M: [0.75, 1.25, 1.75, 2.5, 3.25], F: [0.5, 1, 1.5, 2.25, 3] },
};

// "Squat" and "Bench Press" are what most people call the barbell lifts.
STANDARDS.Squat = STANDARDS['Back Squat'];
STANDARDS['Bench Press'] = STANDARDS['Barbell Bench Press'];

export const hasStandard = (exercise: string) => exercise in STANDARDS;

export interface StrengthRank {
  level: StrengthLevel;
  /** 0–1: how far along the way to the next level. 1 at elite. */
  progress: number;
  /** One-rep max (kg) that reaches the next level; null at elite. */
  nextAt: number | null;
  ratio: number;
}

/** Where an estimated max sits for someone of `bodyWeightKg`; null for lifts without a standard. */
export function strengthRank(exercise: string, maxKg: number, bodyWeightKg: number, gender: Gender): StrengthRank | null {
  const table = STANDARDS[exercise]?.[gender];
  if (!table || bodyWeightKg <= 0 || maxKg <= 0) return null;
  const ratio = maxKg / bodyWeightKg;
  let i = -1;
  while (i + 1 < table.length && ratio >= table[i + 1]) i++;
  if (i === table.length - 1) return { level: 'elite', progress: 1, nextAt: null, ratio };
  // Below the beginner mark still counts as beginner, on the way to novice.
  const from = i < 0 ? 0 : table[i];
  i = Math.max(i, 0);
  const to = table[i + 1];
  return {
    level: STRENGTH_LEVELS[i],
    progress: (ratio - from) / (to - from),
    nextAt: to * bodyWeightKg,
    ratio,
  };
}
