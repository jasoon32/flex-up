/** Muscle groups for weekly set counts; every exercise counts toward its main group only. */
export const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'] as const;
export type Muscle = (typeof MUSCLES)[number];

/**
 * Checked in order, so the specific patterns win ("Leg Curl" is legs before "curl" means arms,
 * "Rear Delt Fly" is shoulders before "fly" means chest). Cardio and full-body moves have no group.
 */
const RULES: [RegExp, Muscle | null][] = [
  [
    /\b(run|walk|bike|elliptical|stair|jump rope|burpee|box jump|battle rope|sled|clean|snatch|thruster|swing|get-up|farmer)/,
    null,
  ],
  [/crunch|plank|sit-up|ab wheel|leg raise|knee raise|captain|russian twist|dead bug|pallof|woodchopper|mountain climber|\babs?\b|core/, 'core'],
  [/hip thrust|glute|pull-through|abductor|adductor|romanian|stiff-leg|good morning/, 'glutes'],
  [/squat|leg press|lunge|step-up|leg extension|leg curl|hamstring|calf|tibialis|\blegs?\b/, 'legs'],
  [/curl|tricep|pushdown|skull|kickback|jm press|wrist|bench dip|dead hang|\barms?\b/, 'arms'],
  [/shoulder|overhead|lateral|front raise|rear delt|reverse pec|face pull|upright|landmine|arnold|push press|\bdelts?\b/, 'shoulders'],
  [/bench|chest|fly|pec deck|push-up|crossover|pullover|floor press|\bdips?\b/, 'chest'],
  [/row|pull|\blat\b|chin|deadlift|rack pull|shrug|back extension|\bback\b/, 'back'],
];

export function muscleOf(exercise: string): Muscle | null {
  const name = exercise.toLowerCase();
  for (const [pattern, muscle] of RULES) if (pattern.test(name)) return muscle;
  return null;
}

/** Weekly working sets per muscle that most hypertrophy research lands on: 10–20. */
export const WEEKLY_SET_TARGET = { min: 10, max: 20 };
