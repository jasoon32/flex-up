import { supabase } from '@/lib/supabase';
import { must } from '@/lib/errors';
import { asSetType, asUnit, setVolumeKg, toKg } from '@/lib/units';
import { e1rm } from '@/lib/strength';
import { levelFromXp, XP, type LevelInfo } from '@/lib/levels';
import { muscleOf, type Muscle } from '@/lib/muscles';
import type { SetType, WeightUnit } from '@/lib/types';

/** A finished workout, as the progress screens need it. */
export interface DoneSession {
  id: string;
  plan_name: string;
  started_at: string;
  completed_at: string;
}

/** A ticked set from a finished workout. */
export interface DoneSet {
  session_id: string;
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  weight_unit: WeightUnit;
  per_side: boolean;
  set_type: SetType;
}

/** One exercise in one workout. */
export interface ExerciseEntry {
  sessionId: string;
  date: Date;
  sets: DoneSet[];
  /** Heaviest working set in kg (0 for bodyweight-only). */
  topKg: number;
  /** Best estimated one-rep max in kg, from sets of 12 reps or fewer. */
  e1rmKg: number | null;
  volumeKg: number;
  /** Most reps in one set without added weight. */
  topReps: number;
  /** This workout set a new best (heavier, or more bodyweight reps) than every earlier one. */
  record: boolean;
}

export interface ExerciseHistory {
  name: string;
  /** The unit it was last logged in. */
  unit: WeightUnit;
  entries: ExerciseEntry[];
  bestKg: number;
  bestE1rmKg: number | null;
  bestReps: number;
  /** Heaviest weight (kg) lifted for each rep count. */
  repBests: Map<number, number>;
}

export interface WeekStat {
  start: Date;
  workouts: number;
  volumeKg: number;
}

export type BadgeId =
  | 'first'
  | 'w10'
  | 'w25'
  | 'w50'
  | 'w100'
  | 'streak3'
  | 'streak7'
  | 'pr1'
  | 'pr10'
  | 'pr50'
  | 'sets100'
  | 'sets1000'
  | 'ton10'
  | 'ton100'
  | 'early'
  | 'late'
  | 'long'
  | 'lvl5'
  | 'lvl10';

export interface Badge {
  id: BadgeId;
  earned: boolean;
  /** 0–1 toward earning it. */
  progress: number;
}

export interface Progress {
  sessions: DoneSession[];
  exercises: ExerciseHistory[];
  totals: { workouts: number; sets: number; volumeKg: number; minutes: number; records: number };
  /** "2026-10-24" for every day with a finished workout. */
  days: Set<string>;
  /** Monday-started weeks, oldest first, ending with this week. */
  weeks: WeekStat[];
  /** Working sets per muscle group this week. */
  muscles: Record<Muscle, number>;
  month: { workouts: number; volumeKg: number; sets: number; minutes: number };
  lastMonth: { workouts: number; volumeKg: number; sets: number; minutes: number };
  longestStreak: number;
  currentStreak: number;
  level: LevelInfo;
  badges: Badge[];
}

const PAGE = 1000;

/** Supabase returns at most 1,000 rows per request, so long histories come in pages. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = must(await page(from, from + PAGE - 1));
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const minutesOf = (s: DoneSession) =>
  Math.max(0, Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000));

/** Every finished workout and its ticked sets. */
export async function loadHistory(): Promise<{ sessions: DoneSession[]; sets: DoneSet[] }> {
  const [sessions, rows] = await Promise.all([
    fetchAll<DoneSession>((from, to) =>
      supabase
        .from('workout_sessions')
        .select('id, plan_name, started_at, completed_at')
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: true })
        .range(from, to),
    ),
    fetchAll<any>((from, to) =>
      supabase
        .from('session_sets')
        .select('session_id, exercise_name, set_number, weight, reps, weight_unit, per_side, set_type')
        .eq('completed', true)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);
  const finished = new Set(sessions.map((s) => s.id));
  const sets: DoneSet[] = rows
    .filter((r) => finished.has(r.session_id))
    .map((r) => ({
      session_id: r.session_id,
      exercise_name: r.exercise_name,
      set_number: Number(r.set_number),
      weight: r.weight === null ? null : Number(r.weight),
      reps: r.reps === null ? null : Number(r.reps),
      weight_unit: asUnit(r.weight_unit),
      per_side: !!r.per_side,
      set_type: asSetType(r.set_type),
    }));
  return { sessions, sets };
}

/** Per-exercise history, oldest workout first, with records marked as they happened. */
export function buildExercises(sessions: DoneSession[], sets: DoneSet[]): ExerciseHistory[] {
  const order = new Map(sessions.map((s, i) => [s.id, i]));
  const dates = new Map(sessions.map((s) => [s.id, new Date(s.started_at)]));
  const byName = new Map<string, Map<string, DoneSet[]>>();
  for (const s of sets) {
    if (s.set_type === 'warmup') continue;
    const perSession = byName.get(s.exercise_name) ?? new Map<string, DoneSet[]>();
    perSession.set(s.session_id, [...(perSession.get(s.session_id) ?? []), s]);
    byName.set(s.exercise_name, perSession);
  }

  const out: ExerciseHistory[] = [];
  for (const [name, perSession] of byName) {
    const ids = [...perSession.keys()].sort((a, b) => order.get(a)! - order.get(b)!);
    let bestKg = 0;
    let bestReps = 0;
    let bestE1rmKg: number | null = null;
    const repBests = new Map<number, number>();
    const entries: ExerciseEntry[] = ids.map((id, i) => {
      const list = perSession.get(id)!.sort((a, b) => a.set_number - b.set_number);
      const kgOf = (s: DoneSet) => toKg(s.weight ?? 0, s.weight_unit);
      const topKg = Math.max(0, ...list.map(kgOf));
      const topReps = Math.max(0, ...list.filter((s) => !s.weight).map((s) => s.reps ?? 0));
      const maxes = list.map((s) => e1rm(kgOf(s), s.reps ?? 0)).filter((v): v is number => v !== null);
      const best1 = maxes.length ? Math.max(...maxes) : null;
      for (const s of list) {
        const kg = kgOf(s);
        if (kg > 0 && s.reps) repBests.set(s.reps, Math.max(repBests.get(s.reps) ?? 0, kg));
      }
      // Like the 🏆 on the finish screen: the first time doesn't count, beating every earlier time does.
      const record = i > 0 && ((topKg > 0 && topKg > bestKg + 0.05) || (topKg === 0 && bestKg === 0 && topReps > bestReps));
      bestKg = Math.max(bestKg, topKg);
      bestReps = Math.max(bestReps, topReps);
      if (best1 !== null) bestE1rmKg = Math.max(bestE1rmKg ?? 0, best1);
      return {
        sessionId: id,
        date: dates.get(id)!,
        sets: list,
        topKg,
        e1rmKg: best1,
        volumeKg: list.reduce((t, s) => t + setVolumeKg(s), 0),
        topReps,
        record,
      };
    });
    const lastSets = entries[entries.length - 1].sets;
    out.push({
      name,
      unit: lastSets[lastSets.length - 1]?.weight_unit ?? 'kg',
      entries,
      bestKg,
      bestE1rmKg,
      bestReps,
      repBests,
    });
  }
  // Most recently trained first.
  return out.sort((a, b) => b.entries[b.entries.length - 1].date.getTime() - a.entries[a.entries.length - 1].date.getTime());
}

function streaks(days: Set<string>): { longest: number; current: number } {
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(`${k}T00:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  // The current streak survives today until the day is over.
  let current = 0;
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { longest, current };
}

/** Everything on the Progress tab, worked out from history so nothing extra is stored. */
export async function loadProgress(weeksBack = 8): Promise<Progress> {
  const { sessions, sets } = await loadHistory();
  const exercises = buildExercises(sessions, sets);
  const working = sets.filter((s) => s.set_type !== 'warmup');

  const days = new Set(sessions.map((s) => dayKey(new Date(s.started_at))));
  const records = exercises.reduce((n, e) => n + e.entries.filter((x) => x.record).length, 0);
  const volumeKg = working.reduce((t, s) => t + setVolumeKg(s), 0);
  const minutes = sessions.reduce((t, s) => t + minutesOf(s), 0);

  const thisMonday = mondayOf(new Date());
  const weeks: WeekStat[] = Array.from({ length: weeksBack }, (_, i) => {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - 7 * (weeksBack - 1 - i));
    return { start, workouts: 0, volumeKg: 0 };
  });
  const sessionWeek = new Map<string, WeekStat>();
  for (const s of sessions) {
    const monday = mondayOf(new Date(s.started_at)).getTime();
    const week = weeks.find((w) => w.start.getTime() === monday);
    if (week) {
      week.workouts++;
      sessionWeek.set(s.id, week);
    }
  }
  for (const s of working) {
    const week = sessionWeek.get(s.session_id);
    if (week) week.volumeKg += setVolumeKg(s);
  }

  const muscles = { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0, core: 0 } as Record<Muscle, number>;
  const thisWeekIds = new Set(sessions.filter((s) => new Date(s.started_at) >= thisMonday).map((s) => s.id));
  for (const s of working) {
    if (!thisWeekIds.has(s.session_id)) continue;
    const m = muscleOf(s.exercise_name);
    if (m) muscles[m]++;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthOf = (from: Date, to: Date) => {
    const list = sessions.filter((s) => new Date(s.started_at) >= from && new Date(s.started_at) < to);
    const ids = new Set(list.map((s) => s.id));
    const inMonth = working.filter((s) => ids.has(s.session_id));
    return {
      workouts: list.length,
      volumeKg: inMonth.reduce((t, s) => t + setVolumeKg(s), 0),
      sets: inMonth.length,
      minutes: list.reduce((t, s) => t + minutesOf(s), 0),
    };
  };

  const { longest, current } = streaks(days);
  const level = levelFromXp(sessions.length * XP.workout + working.length * XP.set + records * XP.record);

  const hours = sessions.map((s) => new Date(s.started_at).getHours());
  const ratio = (have: number, need: number) => Math.min(1, have / need);
  const badgeList: [BadgeId, number][] = [
    ['first', ratio(sessions.length, 1)],
    ['w10', ratio(sessions.length, 10)],
    ['w25', ratio(sessions.length, 25)],
    ['w50', ratio(sessions.length, 50)],
    ['w100', ratio(sessions.length, 100)],
    ['streak3', ratio(longest, 3)],
    ['streak7', ratio(longest, 7)],
    ['pr1', ratio(records, 1)],
    ['pr10', ratio(records, 10)],
    ['pr50', ratio(records, 50)],
    ['sets100', ratio(working.length, 100)],
    ['sets1000', ratio(working.length, 1000)],
    ['ton10', ratio(volumeKg, 10000)],
    ['ton100', ratio(volumeKg, 100000)],
    ['early', hours.some((h) => h < 7) ? 1 : 0],
    ['late', hours.some((h) => h >= 21) ? 1 : 0],
    ['long', sessions.some((s) => minutesOf(s) >= 90) ? 1 : 0],
    ['lvl5', ratio(level.level, 5)],
    ['lvl10', ratio(level.level, 10)],
  ];

  return {
    sessions,
    exercises,
    totals: { workouts: sessions.length, sets: working.length, volumeKg, minutes, records },
    days,
    weeks,
    muscles,
    month: monthOf(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    lastMonth: monthOf(lastMonthStart, monthStart),
    longestStreak: longest,
    currentStreak: current,
    level,
    badges: badgeList.map(([id, progress]) => ({ id, earned: progress >= 1, progress })),
  };
}

/** XP and level before and after one workout, for the level-up moment on the finish screen. */
export async function levelChange(sessionId: string): Promise<{ before: LevelInfo; after: LevelInfo }> {
  const { sessions, sets } = await loadHistory();
  const xpOf = (list: DoneSession[]) => {
    const ids = new Set(list.map((s) => s.id));
    const kept = sets.filter((s) => ids.has(s.session_id));
    const records = buildExercises(list, kept).reduce((n, e) => n + e.entries.filter((x) => x.record).length, 0);
    return list.length * XP.workout + kept.filter((s) => s.set_type !== 'warmup').length * XP.set + records * XP.record;
  };
  return {
    before: levelFromXp(xpOf(sessions.filter((s) => s.id !== sessionId))),
    after: levelFromXp(xpOf(sessions)),
  };
}

/** Just the lifter's level, for Home and the Character tab. */
export async function loadLevel(): Promise<LevelInfo> {
  const { sessions, sets } = await loadHistory();
  const records = buildExercises(sessions, sets).reduce((n, e) => n + e.entries.filter((x) => x.record).length, 0);
  const working = sets.filter((s) => s.set_type !== 'warmup').length;
  return levelFromXp(sessions.length * XP.workout + working * XP.set + records * XP.record);
}
