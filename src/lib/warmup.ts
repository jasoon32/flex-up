/**
 * Warm-up sets leading up to a working weight: light and high reps first, heavy and short last,
 * so the first working set isn't the first heavy one. Weights are rounded to the step the
 * lifter uses, and anything that rounds to nothing or to the working weight is left out.
 */
export function warmupSets(working: number, step: number): { weight: number; reps: number }[] {
  if (working <= 0) return [];
  const scheme = [
    { pct: 0.4, reps: 10 },
    { pct: 0.6, reps: 6 },
    { pct: 0.8, reps: 3 },
  ];
  const out: { weight: number; reps: number }[] = [];
  for (const { pct, reps } of scheme) {
    const weight = Math.round((working * pct) / step) * step;
    const rounded = Math.round(weight * 100) / 100;
    if (rounded <= 0 || rounded >= working) continue;
    if (out.some((w) => w.weight === rounded)) continue;
    out.push({ weight: rounded, reps });
  }
  return out;
}
