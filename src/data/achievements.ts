import { supabase } from '@/lib/supabase';
import { must } from '@/lib/errors';
import { WEEK_ORDER } from '@/lib/days';
import { strings } from '@/i18n';
import { WEIGHT_UNIT } from '@/theme';
import { asUnit, convertWeight, setVolumeKg, toKg } from '@/lib/units';
import { getSession, groupSets } from './sessions';
import { listPlans } from './plans';
import type { DayOfWeek, ExerciseGroup, SessionSet, SessionWithSets } from '@/lib/types';

/**
 * A best on an exercise: heaviest weight, or most reps when it's done without weight.
 * `matched` means it tied the previous best (🔥) rather than beating it (🏆).
 */
export interface PersonalRecord {
  exercise: string;
  kind: 'weight' | 'reps';
  value: number;
  previous: number;
  matched: boolean;
  /** Unit of a weight record, as the lifter logs that exercise. */
  unit?: 'kg' | 'lb';
}

/** An exercise's best so far: heaviest weight (in kg), and most reps on sets without weight. */
export interface Best {
  weight: number;
  reps: number;
}

export const PB_BROKEN = '🏆';
export const PB_MATCHED = '🔥';

/** How an exercise's completed sets compare with its best before this workout. First-timers never count. */
export function comparePb(exercise: string, sets: SessionSet[], before: Best | undefined): PersonalRecord | null {
  const done = sets.filter((s) => s.completed && s.set_type !== 'warmup');
  if (!before || done.length === 0) return null;
  // Compare in kg so lb and kg sets rank correctly; report in the unit the set was logged in.
  const kg = (s: SessionSet) => toKg(s.weight ?? 0, s.weight_unit);
  const top = done.reduce((t, s) => (kg(s) > kg(t) ? s : t));
  const topWeight = kg(top);
  if (topWeight > 0 && before.weight > 0 && topWeight >= before.weight - 0.05) {
    const unit = top.weight_unit === 'lb' ? 'lb' : 'kg';
    const previous = unit === 'lb' ? convertWeight(before.weight, 'kg', 'lb')! : Math.round(before.weight * 10) / 10;
    const matched = Math.abs(topWeight - before.weight) < 0.05;
    return { exercise, kind: 'weight', value: top.weight!, previous, matched, unit };
  }
  const topReps = Math.max(0, ...done.filter((s) => !s.weight).map((s) => s.reps ?? 0));
  if (topWeight === 0 && topReps > 0 && before.reps > 0 && topReps >= before.reps) {
    return { exercise, kind: 'reps', value: topReps, previous: before.reps, matched: topReps === before.reps };
  }
  return null;
}

/** "🏆🏆🔥" — one emoji per record, broken first; long runs collapse to "🏆×12". */
export function pbRow(prs: PersonalRecord[]): string {
  const broken = prs.filter((p) => !p.matched).length;
  const matched = prs.length - broken;
  const part = (n: number, e: string) => (n === 0 ? '' : n > 6 ? `${e}×${n}` : e.repeat(n));
  return [part(broken, PB_BROKEN), part(matched, PB_MATCHED)].filter(Boolean).join(' ');
}

/** Bests per exercise across the given finished workouts. */
export async function getBests(names: string[], sessionIds: string[]): Promise<Map<string, Best>> {
  const best = new Map<string, Best>();
  if (names.length === 0 || sessionIds.length === 0) return best;
  const rows = must(
    await supabase
      .from('session_sets')
      .select('exercise_name, weight, weight_unit, reps')
      .in('session_id', sessionIds.slice(-300))
      .in('exercise_name', names)
      .eq('completed', true)
      .neq('set_type', 'warmup'),
  ) as { exercise_name: string; weight: number | null; weight_unit: string | null; reps: number | null }[];
  for (const r of rows) {
    const b = best.get(r.exercise_name) ?? { weight: 0, reps: 0 };
    b.weight = Math.max(b.weight, toKg(Number(r.weight ?? 0), asUnit(r.weight_unit)));
    if (!r.weight) b.reps = Math.max(b.reps, Number(r.reps ?? 0));
    best.set(r.exercise_name, b);
  }
  return best;
}

/** Bests from every workout finished before `beforeIso`, for live 🏆/🔥 while logging. */
export async function getBestsBefore(names: string[], beforeIso: string): Promise<Map<string, Best>> {
  const earlier = must(
    await supabase
      .from('workout_sessions')
      .select('id')
      .not('completed_at', 'is', null)
      .lt('started_at', beforeIso)
      .order('started_at', { ascending: true }),
  ) as { id: string }[];
  return getBests(
    names,
    earlier.map((s) => s.id),
  );
}

export type Milestone =
  | { kind: 'first' }
  | { kind: 'count'; n: number }
  | { kind: 'pr'; pr: PersonalRecord }
  | { kind: 'streak'; days: number }
  | { kind: 'week' };

/** Everything the finish screen and share cards show about one finished workout. */
export interface WorkoutRecap {
  session: SessionWithSets;
  /** Exercises with their completed sets only. */
  done: ExerciseGroup[];
  completedSets: number;
  totalSets: number;
  volume: number;
  minutes: number;
  /** This is the user's nth finished workout. */
  workoutNumber: number;
  /** Days in a row with a finished workout, ending on this workout's day. */
  streakDays: number;
  /** Planned days of this workout's week, and which of them have a finished workout. */
  week: { day: DayOfWeek; planned: boolean; done: boolean }[];
  /** Records broken (🏆) first, then matched (🔥); at most one per exercise. */
  prs: PersonalRecord[];
  /** The headline achievement, if any; drives the big celebration. */
  milestone: Milestone | null;
}

/** "62.5 kg" or "15 reps". */
export function formatPr(pr: Pick<PersonalRecord, 'kind' | 'value' | 'unit'>): string {
  return pr.kind === 'weight' ? `${pr.value} ${pr.unit ?? WEIGHT_UNIT}` : strings().celebrate.reps(pr.value);
}

const COUNT_MILESTONES = [5, 10, 25, 50, 100, 200, 365, 500];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Works out the achievements for a workout from the history already logged, so
 * nothing extra is stored: finishing the same workout again shows the same result.
 */
export async function getWorkoutRecap(sessionId: string): Promise<WorkoutRecap> {
  const [session, finished, plans] = await Promise.all([
    getSession(sessionId),
    supabase
      .from('workout_sessions')
      .select('id, started_at')
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: true })
      .then((r) => must(r) as { id: string; started_at: string }[]),
    listPlans().catch(() => []),
  ]);

  const started = new Date(session.started_at);
  const earlier = finished.filter((s) => s.id !== session.id && new Date(s.started_at) < started);
  const workoutNumber = earlier.length + 1;

  // Streak: count back day by day from this workout's day.
  const days = new Set([...earlier.map((s) => dayKey(new Date(s.started_at))), dayKey(started)]);
  let streakDays = 0;
  const cursor = new Date(started);
  while (days.has(dayKey(cursor))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // This workout's week (Monday to Sunday): planned days and finished days.
  const monday = mondayOf(started);
  const plannedDays = new Set(plans.flatMap((p) => p.days));
  const week = WEEK_ORDER.map((day, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { day, planned: plannedDays.has(day), done: days.has(dayKey(date)) && date <= started };
  });
  const plannedCount = week.filter((d) => d.planned).length;
  const fullWeek = plannedCount >= 2 && week.every((d) => !d.planned || d.done);

  const done = groupSets(session.sets.filter((s) => s.completed));
  const completed = done.flatMap((g) => g.sets);
  const volume = completed.reduce((t, s) => t + setVolumeKg(s), 0);
  const end = session.completed_at ? new Date(session.completed_at) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - started.getTime()) / 60000));

  const prs = await findPersonalRecords(done, earlier.map((s) => s.id)).catch(() => []);

  let milestone: Milestone | null = null;
  if (workoutNumber === 1) milestone = { kind: 'first' };
  else if (COUNT_MILESTONES.includes(workoutNumber)) milestone = { kind: 'count', n: workoutNumber };
  else if (prs.some((p) => !p.matched)) milestone = { kind: 'pr', pr: prs[0] };
  else if (STREAK_MILESTONES.includes(streakDays)) milestone = { kind: 'streak', days: streakDays };
  else if (fullWeek) milestone = { kind: 'week' };

  return {
    session,
    done,
    completedSets: completed.length,
    totalSets: session.sets.length,
    volume,
    minutes,
    workoutNumber,
    streakDays,
    week,
    prs,
    milestone,
  };
}

/** Compares this workout's exercises with every earlier finished workout; broken records come first. */
async function findPersonalRecords(done: ExerciseGroup[], earlierIds: string[]): Promise<PersonalRecord[]> {
  const best = await getBests(
    done.map((g) => g.name),
    earlierIds,
  );
  const prs = done.map((g) => comparePb(g.name, g.sets, best.get(g.name))).filter((p): p is PersonalRecord => !!p);
  return prs.sort((a, b) => Number(a.matched) - Number(b.matched));
}
