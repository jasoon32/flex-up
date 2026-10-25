/** 0 = Sunday … 6 = Saturday (matches Date.getDay()). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Warm-up sets are logged but don't count toward volume or records; drop and failure sets are tags. */
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

/** How an exercise's weight is entered. 'bw' = bodyweight: blank is bodyweight, a number is added kg. */
export type WeightUnit = 'kg' | 'lb' | 'bw';

export interface Plan {
  id: string;
  name: string;
  days: DayOfWeek[];
  created_at: string;
}

export interface PlanExercise {
  id: string;
  plan_id: string;
  name: string;
  target_sets: number;
  target_reps: number;
  /** Top of the rep range ("6–8" → 8); null for a single target. */
  target_reps_max: number | null;
  target_weight: number | null;
  /** Rest after each set in seconds; null uses the default from Settings. */
  rest_seconds: number | null;
  weight_unit: WeightUnit;
  /** Weight is per hand or per side (dumbbells, single-arm cables); volume counts both. */
  per_side: boolean;
  position: number;
}

export interface PlanWithExercises extends Plan {
  exercises: PlanExercise[];
}

/** An exercise row in the plan editor; `id` is absent until it is saved. */
export interface DraftExercise {
  id?: string;
  name: string;
  target_sets: number;
  target_reps: number;
  target_reps_max: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  weight_unit: WeightUnit;
  per_side: boolean;
}

export interface WorkoutSession {
  id: string;
  plan_id: string | null;
  plan_name: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface SessionSet {
  id: string;
  session_id: string;
  exercise_name: string;
  exercise_order: number;
  set_number: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  completed: boolean;
  /** Snapshot of the exercise's unit and per-hand setting when the set was logged. */
  weight_unit: WeightUnit;
  per_side: boolean;
  set_type: SetType;
}

export type SetPatch = Partial<Pick<SessionSet, 'reps' | 'weight' | 'rpe' | 'completed' | 'weight_unit' | 'set_type'>>;

export interface SessionWithSets extends WorkoutSession {
  sets: SessionSet[];
}

export interface ExerciseGroup {
  order: number;
  name: string;
  sets: SessionSet[];
}

export interface HistoryItem extends WorkoutSession {
  completedSets: number;
  totalSets: number;
  volume: number;
  /** Per exercise, its completed sets written out ("80×6 @7 · 80×6"). */
  exercises: { name: string; summary: string }[];
}
