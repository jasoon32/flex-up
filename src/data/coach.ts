import { supabase } from '@/lib/supabase';
import { check } from '@/lib/errors';
import { askAi, readAiCache, writeAiCache, type WeeklyReport } from '@/lib/ai';
import { muscleOf, MUSCLES } from '@/lib/muscles';
import { formatPr, type WorkoutRecap } from './achievements';
import { EXERCISE_LIBRARY } from './exerciseLibrary';
import { exerciseDefaults, trName } from './names';
import { dayKey, loadProgress, mondayOf, type ExerciseEntry, type ExerciseHistory } from './progress';
import { formatSet, getLastSets } from './sessions';
import { listPlans } from './plans';
import type { ExerciseGroup, WeightUnit } from '@/lib/types';

/** Short text for one exercise's sets, the way the app writes them ("80×6 · 80×5"). */
const setsText = (sets: { weight: number | null; reps: number | null; weight_unit: WeightUnit }[]) =>
  sets.map((s) => formatSet({ ...s, rpe: null })).join(', ');

// ---------------------------------------------------------------------------
// Workout recap: written once after Finish and kept on the workout for History.
// ---------------------------------------------------------------------------

/** The saved coach note for a workout, or a new one written (and saved) now. */
export async function getCoachRecap(recap: WorkoutRecap): Promise<string> {
  const saved = recap.session.ai_recap;
  if (saved) return saved;

  const names = recap.done.map((g) => g.name);
  const last = await getLastSets(names, recap.session.started_at).catch(() => new Map());
  const data = {
    workout: trName(recap.session.plan_name, 'plan'),
    minutes: recap.minutes,
    workoutNumber: recap.workoutNumber,
    streakDays: recap.streakDays,
    exercises: recap.done.map((g) => ({
      name: trName(g.name),
      today: setsText(g.sets),
      last: last.get(g.name) ? setsText(last.get(g.name)!.filter((s: { completed: boolean }) => s.completed)) : null,
    })),
    records: recap.prs.map((p) => ({
      exercise: trName(p.exercise),
      value: formatPr(p),
      previous: formatPr({ ...p, value: p.previous }),
      matched: p.matched,
    })),
  };
  const { text } = await askAi('recap', data);
  if (text) {
    // Saving is a bonus: if the database isn't updated yet, the note still shows this time.
    await supabase
      .from('workout_sessions')
      .update({ ai_recap: text })
      .eq('id', recap.session.id)
      .then(
        () => undefined,
        () => undefined,
      );
  }
  return text;
}

// ---------------------------------------------------------------------------
// Machine busy swap: alternatives for the same muscle, picked by the coach.
// ---------------------------------------------------------------------------

export interface SwapOption {
  name: string;
  why: string;
}

/** Library exercises that train the same muscle group, for the coach to choose from. */
export function swapCandidates(exercise: string, inWorkout: string[]): string[] {
  const muscle = muscleOf(exercise);
  if (!muscle) return [];
  const skip = new Set([exercise, ...inWorkout]);
  return EXERCISE_LIBRARY.filter((n) => !skip.has(n) && muscleOf(n) === muscle).slice(0, 60);
}

/**
 * Three swaps for an exercise. The coach picks from the library; if it can't answer
 * (daily cap, busy, offline), the first library matches are offered instead.
 */
export async function findSwaps(
  exercise: string,
  inWorkout: string[],
): Promise<{ options: SwapOption[]; fromCoach: boolean }> {
  const candidates = swapCandidates(exercise, inWorkout);
  if (candidates.length === 0) return { options: [], fromCoach: false };
  try {
    const { options } = await askAi('swap', { exercise, inWorkout, candidates });
    if (options.length > 0) return { options, fromCoach: true };
  } catch {
    // Fall through to the plain library list.
  }
  return { options: candidates.slice(0, 3).map((name) => ({ name, why: '' })), fromCoach: false };
}

/** Renames one exercise in a workout, keeping its sets; unticked sets take the new exercise's unit. */
export async function swapSessionExercise(sessionId: string, group: ExerciseGroup, name: string): Promise<void> {
  const first = group.sets[0];
  const defaults = exerciseDefaults(name, {
    weight_unit: first?.weight_unit ?? 'kg',
    per_side: first?.per_side ?? false,
  });
  check(
    await supabase
      .from('session_sets')
      .update({ exercise_name: name, ...defaults })
      .eq('session_id', sessionId)
      .eq('exercise_order', group.order)
      .eq('completed', false),
  );
  // Ticked sets keep their unit; only the name changes so History reads right.
  check(
    await supabase
      .from('session_sets')
      .update({ exercise_name: name })
      .eq('session_id', sessionId)
      .eq('exercise_order', group.order)
      .eq('completed', true),
  );
}

// ---------------------------------------------------------------------------
// Plateau alerts: lifts with no new best for 3 weeks while still being trained.
// ---------------------------------------------------------------------------

const DAY = 86400000;
export const PLATEAU_DAYS = 21;

export interface Plateau {
  exercise: ExerciseHistory;
  /** Whole weeks since the last new best. */
  weeks: number;
}

/** A best for one workout: estimated max, else heaviest weight, else most bodyweight reps. */
const scoreOf = (e: ExerciseEntry) => e.e1rmKg ?? (e.topKg > 0 ? e.topKg : e.topReps);

/**
 * Stuck lifts: trained at least 3 times in the last 3 weeks, with history from before that,
 * and nothing in those 3 weeks beat the best from before.
 */
export function findPlateaus(exercises: ExerciseHistory[], now = new Date()): Plateau[] {
  const cutoff = now.getTime() - PLATEAU_DAYS * DAY;
  const out: Plateau[] = [];
  for (const ex of exercises) {
    const before = ex.entries.filter((e) => e.date.getTime() < cutoff);
    const recent = ex.entries.filter((e) => e.date.getTime() >= cutoff);
    if (before.length === 0 || recent.length < 3) continue;
    const bestBefore = Math.max(...before.map(scoreOf));
    if (bestBefore <= 0 || recent.some((e) => scoreOf(e) > bestBefore + 0.05)) continue;
    // When the best was last reached or beaten, counted back from today.
    let lastBest = before[0].date.getTime();
    let best = -1;
    for (const e of ex.entries) {
      if (scoreOf(e) > best + 0.05) {
        best = scoreOf(e);
        lastBest = e.date.getTime();
      }
    }
    out.push({ exercise: ex, weeks: Math.max(3, Math.floor((now.getTime() - lastBest) / (7 * DAY))) });
  }
  return out.sort((a, b) => b.weeks - a.weeks);
}

const weekKey = () => dayKey(mondayOf(new Date()));

/** A remembered tip for this week, without asking the coach. */
export const savedPlateauTip = (exercise: string) => readAiCache<string>(`plateau.${weekKey()}.${exercise}`);

/** The coach's fix for one stuck lift, asked at most once a week per lift on this device. */
export async function getPlateauTip(p: Plateau): Promise<string> {
  const saved = savedPlateauTip(p.exercise.name);
  if (saved) return saved;
  const history = p.exercise.entries.slice(-8).map((e) => {
    const top = [...e.sets].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
    return { date: dayKey(e.date), best: top ? formatSet({ ...top, rpe: null }) : '' };
  });
  const { tip } = await askAi('plateau', { exercise: trName(p.exercise.name), weeksStuck: p.weeks, history });
  if (tip) writeAiCache(`plateau.${weekKey()}.${p.exercise.name}`, tip);
  return tip;
}

// ---------------------------------------------------------------------------
// Sunday report card: written once per week and saved, shown on Home on Sundays.
// ---------------------------------------------------------------------------

export const isReportDay = (d = new Date()) => d.getDay() === 0;

const dismissKey = (week: string) => `report.dismissed.${week}`;
export const reportDismissed = () => readAiCache<boolean>(dismissKey(weekKey())) === true;
export const dismissReport = () => writeAiCache(dismissKey(weekKey()), true);

/** This week's report: the saved one, or a new one written from this week's training. */
export async function getWeeklyReport(): Promise<WeeklyReport> {
  const week = weekKey();
  const { data: saved } = await supabase.from('ai_reports').select('body').eq('week_start', week).maybeSingle();
  if (saved?.body) return saved.body as WeeklyReport;

  const [progress, plans] = await Promise.all([loadProgress(2), listPlans().catch(() => [])]);
  const monday = mondayOf(new Date());
  const thisWeek = progress.exercises
    .flatMap((ex) => ex.entries.filter((e) => e.date >= monday).map((e) => ({ ex, e })))
    .filter(({ e }) => e.record)
    .map(({ ex }) => trName(ex.name));
  const [last, now] = progress.weeks.slice(-2);
  const data = {
    workouts: now?.workouts ?? 0,
    planned: new Set(plans.flatMap((p) => p.days)).size,
    volumeKg: Math.round(now?.volumeKg ?? 0),
    lastWeekVolumeKg: Math.round(last?.volumeKg ?? 0),
    records: [...new Set(thisWeek)],
    streakDays: progress.currentStreak,
    muscleSets: Object.fromEntries(MUSCLES.map((m) => [m, progress.muscles[m]])),
    stuck: findPlateaus(progress.exercises).map((p) => trName(p.exercise.name)),
  };
  const report = await askAi('weekly', data);
  // Kept so the card reads the same all day and costs one AI call a week.
  await supabase
    .from('ai_reports')
    .upsert({ week_start: week, body: report })
    .then(
      () => undefined,
      () => undefined,
    );
  return report;
}
