import { savePlan } from './plans';
import { exerciseDefaults } from './names';
import type { DayOfWeek, DraftExercise } from '@/lib/types';

/** [name, sets, min reps, max reps or null, rest seconds or null] */
type Ex = [string, number, number, number | null, number | null];

export interface ProgramPlan {
  /** A built-in plan name, so it shows translated. */
  name: string;
  days: DayOfWeek[];
  exercises: Ex[];
}

export type ProgramId = 'fullbody' | 'fivebyfive' | 'upperlower' | 'ppl' | 'ppl6' | 'glutes' | 'home';

export interface Program {
  id: ProgramId;
  /** Training days a week. */
  perWeek: number;
  level: 'beginner' | 'intermediate';
  plans: ProgramPlan[];
}

const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

/**
 * Proven splits from the programs lifters keep coming back to (and that the big apps ship):
 * full body for beginners, 5×5 for strength, upper/lower and push/pull/legs for size.
 * Every name is a built-in one, so the plans read in English or Chinese.
 */
export const PROGRAMS: Program[] = [
  {
    id: 'fullbody',
    perWeek: 3,
    level: 'beginner',
    plans: [
      {
        name: 'Full Body A',
        days: [MON, FRI],
        exercises: [
          ['Back Squat', 3, 6, 8, 150],
          ['Barbell Bench Press', 3, 6, 8, 150],
          ['Seated Cable Row', 3, 8, 12, null],
          ['Dumbbell Shoulder Press', 2, 8, 12, null],
          ['Cable Crunch', 2, 10, 15, 60],
        ],
      },
      {
        name: 'Full Body B',
        days: [WED],
        exercises: [
          ['Romanian Deadlift', 3, 6, 10, 150],
          ['Incline DB Bench Press', 3, 8, 12, null],
          ['Lat Pulldown', 3, 8, 12, null],
          ['Leg Press', 3, 10, 12, null],
          ['DB Bicep Curl', 2, 10, 12, 60],
        ],
      },
    ],
  },
  {
    id: 'fivebyfive',
    perWeek: 3,
    level: 'beginner',
    plans: [
      {
        name: 'Strength A',
        days: [MON, FRI],
        exercises: [
          ['Back Squat', 5, 5, null, 180],
          ['Barbell Bench Press', 5, 5, null, 180],
          ['Barbell Row', 5, 5, null, 180],
        ],
      },
      {
        name: 'Strength B',
        days: [WED],
        exercises: [
          ['Back Squat', 5, 5, null, 180],
          ['Overhead Press', 5, 5, null, 180],
          ['Deadlift', 1, 5, null, 180],
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    perWeek: 4,
    level: 'intermediate',
    plans: [
      {
        name: 'Upper A',
        days: [MON],
        exercises: [
          ['Barbell Bench Press', 4, 5, 8, 150],
          ['Barbell Row', 4, 6, 10, 120],
          ['Overhead Press', 3, 6, 10, 120],
          ['Lat Pulldown', 3, 8, 12, null],
          ['Triceps Pushdown', 3, 10, 15, 60],
          ['DB Bicep Curl', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Lower A',
        days: [TUE],
        exercises: [
          ['Back Squat', 4, 5, 8, 180],
          ['Romanian Deadlift', 3, 8, 10, 120],
          ['Leg Extension', 3, 10, 15, 60],
          ['Seated Leg Curl', 3, 10, 15, 60],
          ['Standing Calf Raise', 4, 10, 15, 60],
        ],
      },
      {
        name: 'Upper B',
        days: [THU],
        exercises: [
          ['Incline DB Bench Press', 4, 8, 12, null],
          ['Pull-Up', 4, 6, 10, 120],
          ['Seated Cable Row', 3, 10, 12, null],
          ['Lateral Raise', 4, 12, 20, 60],
          ['Cable Overhead Triceps Extension', 3, 10, 15, 60],
          ['Hammer Curl', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Lower B',
        days: [FRI],
        exercises: [
          ['Deadlift', 3, 3, 5, 180],
          ['Leg Press', 3, 10, 15, null],
          ['Bulgarian Split Squat', 3, 8, 12, null],
          ['Lying Leg Curl', 3, 10, 15, 60],
          ['Hanging Leg Raise', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    id: 'ppl',
    perWeek: 3,
    level: 'beginner',
    plans: [
      {
        name: 'Push',
        days: [MON],
        exercises: [
          ['Barbell Bench Press', 3, 6, 10, 150],
          ['Dumbbell Shoulder Press', 3, 8, 12, null],
          ['Incline DB Bench Press', 3, 8, 12, null],
          ['Lateral Raise', 3, 12, 20, 60],
          ['Triceps Pushdown', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Pull',
        days: [WED],
        exercises: [
          ['Lat Pulldown', 3, 8, 12, null],
          ['Barbell Row', 3, 6, 10, 120],
          ['Face Pull', 3, 12, 20, 60],
          ['DB Bicep Curl', 3, 10, 15, 60],
          ['Hammer Curl', 2, 10, 15, 60],
        ],
      },
      {
        name: 'Legs',
        days: [FRI],
        exercises: [
          ['Back Squat', 3, 6, 10, 180],
          ['Romanian Deadlift', 3, 8, 12, 120],
          ['Leg Press', 3, 10, 15, null],
          ['Seated Leg Curl', 3, 10, 15, 60],
          ['Standing Calf Raise', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    id: 'ppl6',
    perWeek: 6,
    level: 'intermediate',
    plans: [
      {
        name: 'Push A',
        days: [MON],
        exercises: [
          ['Barbell Bench Press', 4, 5, 8, 150],
          ['Overhead Press', 3, 6, 10, 120],
          ['Incline DB Bench Press', 3, 8, 12, null],
          ['Lateral Raise', 4, 12, 20, 60],
          ['Triceps Pushdown', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Pull A',
        days: [TUE],
        exercises: [
          ['Deadlift', 3, 3, 5, 180],
          ['Pull-Up', 4, 6, 10, 120],
          ['Seated Cable Row', 3, 8, 12, null],
          ['Face Pull', 3, 12, 20, 60],
          ['DB Bicep Curl', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Legs A',
        days: [WED],
        exercises: [
          ['Back Squat', 4, 5, 8, 180],
          ['Romanian Deadlift', 3, 8, 10, 120],
          ['Leg Extension', 3, 10, 15, 60],
          ['Seated Leg Curl', 3, 10, 15, 60],
          ['Standing Calf Raise', 4, 10, 15, 60],
        ],
      },
      {
        name: 'Push B',
        days: [THU],
        exercises: [
          ['Overhead Press', 4, 5, 8, 150],
          ['Incline Barbell Bench Press', 3, 6, 10, 120],
          ['Cable Fly', 3, 10, 15, 60],
          ['Lateral Raise', 4, 12, 20, 60],
          ['Cable Overhead Triceps Extension', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Pull B',
        days: [FRI],
        exercises: [
          ['Barbell Row', 4, 6, 10, 120],
          ['Lat Pulldown', 3, 8, 12, null],
          ['Reverse Pec Deck', 3, 12, 20, 60],
          ['Hammer Curl', 3, 10, 15, 60],
          ['Preacher Curl', 2, 10, 15, 60],
        ],
      },
      {
        name: 'Legs B',
        days: [SAT],
        exercises: [
          ['Front Squat', 3, 6, 10, 150],
          ['Barbell Hip Thrust', 3, 8, 12, 120],
          ['Bulgarian Split Squat', 3, 8, 12, null],
          ['Lying Leg Curl', 3, 10, 15, 60],
          ['Seated Calf Raise', 4, 12, 20, 60],
        ],
      },
    ],
  },
  {
    id: 'glutes',
    perWeek: 3,
    level: 'beginner',
    plans: [
      {
        name: 'Glutes & Legs',
        days: [MON],
        exercises: [
          ['Barbell Hip Thrust', 4, 8, 12, 120],
          ['Back Squat', 3, 6, 10, 150],
          ['Bulgarian Split Squat', 3, 8, 12, null],
          ['Hip Abductor', 3, 12, 20, 60],
          ['Cable Glute Kickback', 3, 12, 15, 60],
        ],
      },
      {
        name: 'Upper',
        days: [WED],
        exercises: [
          ['Lat Pulldown', 3, 8, 12, null],
          ['Dumbbell Shoulder Press', 3, 8, 12, null],
          ['Seated Cable Row', 3, 10, 12, null],
          ['Lateral Raise', 3, 12, 20, 60],
          ['Triceps Pushdown', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Glutes & Hamstrings',
        days: [FRI],
        exercises: [
          ['Romanian Deadlift', 4, 8, 12, 120],
          ['Glute Bridge', 3, 10, 15, null],
          ['Walking Lunge', 3, 10, 12, null],
          ['Seated Leg Curl', 3, 10, 15, 60],
          ['Hanging Knee Raise', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    id: 'home',
    perWeek: 3,
    level: 'beginner',
    plans: [
      {
        name: 'Home Full Body A',
        days: [MON, FRI],
        exercises: [
          ['Goblet Squat', 3, 10, 15, null],
          ['Dumbbell Bench Press', 3, 8, 12, null],
          ['One-Arm Dumbbell Row', 3, 8, 12, null],
          ['Dumbbell Shoulder Press', 3, 8, 12, null],
          ['Crunch', 3, 12, 20, 60],
        ],
      },
      {
        name: 'Home Full Body B',
        days: [WED],
        exercises: [
          ['Dumbbell Romanian Deadlift', 3, 10, 12, null],
          ['Push-Up', 3, 8, 15, null],
          ['Dumbbell Lunge', 3, 10, 12, null],
          ['Dumbbell Curl', 3, 10, 15, 60],
          ['Dumbbell Overhead Triceps Extension', 3, 10, 15, 60],
        ],
      },
    ],
  },
];

export function programExercises(plan: ProgramPlan): DraftExercise[] {
  return plan.exercises.map(([name, sets, min, max, rest]) => ({
    name,
    target_sets: sets,
    target_reps: min,
    target_reps_max: max,
    target_weight: null,
    rest_seconds: rest,
    weight_unit: 'kg',
    per_side: false,
    // Bodyweight moves start as BW, dumbbell lifts per hand, like picking them by name in the editor.
    ...exerciseDefaults(name, { weight_unit: 'kg', per_side: false }),
  }));
}

/** Adds every plan in a program to the user's plans, on the program's days. Existing plans are left alone. */
export async function addProgram(program: Program): Promise<void> {
  for (const plan of program.plans) {
    await savePlan(null, { name: plan.name, days: plan.days, exercises: programExercises(plan) });
  }
}
