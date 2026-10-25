import { supabase } from '@/lib/supabase';
import { check, must } from '@/lib/errors';
import { strings } from '@/i18n';
import { asSetType, asUnit, convertWeight, setVolumeKg } from '@/lib/units';
import { exerciseDefaults } from './names';
import { getPlan, savePlan } from './plans';
import type {
  ExerciseGroup,
  HistoryItem,
  PlanWithExercises,
  SessionSet,
  SessionWithSets,
  SetPatch,
  WeightUnit,
  WorkoutSession,
} from '@/lib/types';

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function mapSet(row: any): SessionSet {
  return {
    id: row.id,
    session_id: row.session_id,
    exercise_name: row.exercise_name,
    exercise_order: Number(row.exercise_order),
    set_number: Number(row.set_number),
    reps: toNum(row.reps),
    weight: toNum(row.weight),
    rpe: toNum(row.rpe),
    completed: !!row.completed,
    weight_unit: asUnit(row.weight_unit),
    per_side: !!row.per_side,
    set_type: asSetType(row.set_type),
  };
}

function mapSession(row: any): WorkoutSession {
  return {
    id: row.id,
    plan_id: row.plan_id ?? null,
    plan_name: row.plan_name,
    started_at: row.started_at,
    completed_at: row.completed_at ?? null,
    notes: row.notes ?? null,
  };
}

const bySetOrder = (a: SessionSet, b: SessionSet) => a.exercise_order - b.exercise_order || a.set_number - b.set_number;

/**
 * "80×6 @7", "95 lb×8", "BW×10" or "BW+5×8". The unit is left out when it is kg,
 * or when it matches `sameAs` (the unit the reader is already looking at).
 */
export function formatSet(
  s: Pick<SessionSet, 'weight' | 'reps' | 'rpe'> & Partial<Pick<SessionSet, 'weight_unit'>>,
  sameAs?: WeightUnit,
): string {
  const unit = s.weight_unit ?? 'kg';
  const bw = strings().units.bodyweight;
  const w =
    unit === 'bw'
      ? s.weight
        ? `${bw}+${s.weight}`
        : bw
      : s.weight === null
        ? bw
        : unit === sameAs || (unit === 'kg' && sameAs !== 'lb')
          ? String(s.weight)
          : `${s.weight} ${unit}`;
  return `${w}×${s.reps ?? '–'}${s.rpe !== null ? ` @${s.rpe}` : ''}`;
}

/**
 * For each exercise name, the completed sets from the most recent finished
 * session (started before `before`, if given) that included it.
 */
export async function getLastSets(names: string[], before?: string): Promise<Map<string, SessionSet[]>> {
  const result = new Map<string, SessionSet[]>();
  if (names.length === 0) return result;

  let q = supabase
    .from('workout_sessions')
    .select('id, started_at')
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(30);
  if (before) q = q.lt('started_at', before);
  const sessions = must(await q) as { id: string }[];
  if (sessions.length === 0) return result;

  const rows = must(
    await supabase
      .from('session_sets')
      .select('*')
      .in(
        'session_id',
        sessions.map((s) => s.id),
      )
      .in('exercise_name', names)
      .eq('completed', true)
      // "Last time" means the working sets; warm-ups would shift every row.
      .neq('set_type', 'warmup'),
  ) as any[];

  const rank = new Map(sessions.map((s, i) => [s.id, i]));
  const best = new Map<string, { rank: number; sets: SessionSet[] }>();
  for (const set of rows.map(mapSet)) {
    const r = rank.get(set.session_id) ?? Infinity;
    const cur = best.get(set.exercise_name);
    if (!cur || r < cur.rank) best.set(set.exercise_name, { rank: r, sets: [set] });
    else if (r === cur.rank) cur.sets.push(set);
  }
  for (const [name, { sets }] of best)
    result.set(
      name,
      sets.sort((a, b) => a.set_number - b.set_number),
    );
  return result;
}

/** Last time's weight, in the unit the exercise uses now. */
const prefillWeight = (prev: SessionSet | undefined, unit: WeightUnit) =>
  prev ? convertWeight(prev.weight, prev.weight_unit, unit) : null;

/**
 * Creates a session and pre-fills one row per target set from the plan,
 * using last time's weights where available.
 */
export async function startSession(planId: string): Promise<string> {
  const plan = await getPlan(planId);
  const last = await getLastSets(plan.exercises.map((e) => e.name)).catch(() => new Map<string, SessionSet[]>());

  const session = must(
    await supabase.from('workout_sessions').insert({ plan_id: plan.id, plan_name: plan.name }).select('id').single(),
  ) as { id: string };

  const rows = plan.exercises.flatMap((ex, order) => {
    const prev = last.get(ex.name) ?? [];
    return Array.from({ length: ex.target_sets }, (_, i) => ({
      session_id: session.id,
      exercise_name: ex.name,
      exercise_order: order,
      set_number: i + 1,
      reps: ex.target_reps,
      weight: prefillWeight(prev[i] ?? prev[prev.length - 1], ex.weight_unit) ?? ex.target_weight,
      weight_unit: ex.weight_unit,
      per_side: ex.per_side,
    }));
  });

  if (rows.length > 0) {
    const res = await supabase.from('session_sets').insert(rows);
    if (res.error) {
      // Don't leave an empty half-created session behind.
      await supabase.from('workout_sessions').delete().eq('id', session.id);
      check(res);
    }
  }
  saveSnapshot(session.id, plan);
  return session.id;
}

/**
 * What the plan looked like when an unfinished session last matched it. It's kept
 * on-device. Comparing it with the current plan tells plan edits apart from
 * changes the user made inside the workout (added exercises, deleted sets).
 */
type PlanSnapshot = { name: string; sets: number }[];
const snapshotKey = (sessionId: string) => `flexup.planSnapshot.${sessionId}`;

function saveSnapshot(sessionId: string, plan: PlanWithExercises) {
  const snap: PlanSnapshot = plan.exercises.map((e) => ({ name: e.name, sets: e.target_sets }));
  try {
    localStorage.setItem(snapshotKey(sessionId), JSON.stringify(snap));
  } catch {
    // Without a snapshot the next sync falls back to the session's own exercises.
  }
}

function readSnapshot(sessionId: string): PlanSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(sessionId));
    return raw ? (JSON.parse(raw) as PlanSnapshot) : null;
  } catch {
    return null;
  }
}

function dropSnapshot(sessionId: string) {
  try {
    localStorage.removeItem(snapshotKey(sessionId));
  } catch {
    // Harmless leftover.
  }
}

/**
 * Brings an unfinished session in line with edits made to its plan since it
 * started: new exercises are added, removed ones disappear (ticked sets are
 * kept), set counts follow the new target, and exercises follow the plan's
 * order. Logged values are never overwritten. Returns true if anything changed.
 */
export async function syncSessionWithPlan(session: SessionWithSets): Promise<boolean> {
  if (!session.plan_id || session.completed_at) return false;
  const plan = await getPlan(session.plan_id);
  const groups = groupSets(session.sets);
  // No snapshot (a session started before syncing existed, or on another device):
  // only add what's missing and fix the order; never delete on a guess.
  const before = new Map((readSnapshot(session.id) ?? []).map((x) => [x.name, x.sets]));
  const inPlan = new Set(plan.exercises.map((e) => e.name));
  const byName = new Map(groups.map((g) => [g.name, g]));

  const deletes: string[] = [];
  const inserts: Record<string, unknown>[] = [];

  // Exercises taken out of the plan: drop their unticked sets.
  for (const g of groups) {
    if (before.has(g.name) && !inPlan.has(g.name)) deletes.push(...g.sets.filter((s) => !s.completed).map((s) => s.id));
  }

  // New order: plan exercises in plan order, then anything else the session still has.
  const kept = groups.filter((g) => !inPlan.has(g.name) && g.sets.some((s) => s.completed || !before.has(g.name)));
  const order = new Map<string, number>();
  plan.exercises.forEach((e, i) => order.set(e.name, i));
  kept.forEach((g, i) => order.set(g.name, plan.exercises.length + i));

  const newNames = plan.exercises.filter((e) => !byName.has(e.name) && !before.has(e.name)).map((e) => e.name);
  const last = newNames.length
    ? await getLastSets(newNames).catch(() => new Map<string, SessionSet[]>())
    : new Map<string, SessionSet[]>();

  for (const ex of plan.exercises) {
    const g = byName.get(ex.name);
    const exOrder = order.get(ex.name)!;
    if (!g) {
      // Only add exercises that are new to the plan, not ones the user deleted mid-workout.
      if (before.has(ex.name)) continue;
      const prev = last.get(ex.name) ?? [];
      for (let i = 0; i < ex.target_sets; i++) {
        inserts.push({
          session_id: session.id,
          exercise_name: ex.name,
          exercise_order: exOrder,
          set_number: i + 1,
          reps: ex.target_reps,
          weight: prefillWeight(prev[i] ?? prev[prev.length - 1], ex.weight_unit) ?? ex.target_weight,
          weight_unit: ex.weight_unit,
          per_side: ex.per_side,
        });
      }
      continue;
    }
    const was = before.get(ex.name);
    if (was === undefined || was === ex.target_sets) continue;
    if (ex.target_sets > was) {
      const tail = g.sets[g.sets.length - 1];
      for (let i = 1; i <= ex.target_sets - was; i++) {
        inserts.push({
          session_id: session.id,
          exercise_name: ex.name,
          exercise_order: exOrder,
          set_number: (tail?.set_number ?? 0) + i,
          reps: ex.target_reps,
          weight: tail?.weight ?? ex.target_weight,
          weight_unit: tail?.weight_unit ?? ex.weight_unit,
          per_side: tail?.per_side ?? ex.per_side,
        });
      }
    } else {
      // Fewer sets: remove unticked ones from the end; ticked sets are never deleted.
      const extra = g.sets
        .filter((s) => !s.completed)
        .slice(-(was - ex.target_sets))
        .map((s) => s.id);
      deletes.push(...extra);
    }
  }

  const deleted = new Set(deletes);
  const moves = groups
    .filter((g) => order.has(g.name) && order.get(g.name) !== g.order)
    .map((g) => ({ to: order.get(g.name)!, ids: g.sets.filter((s) => !deleted.has(s.id)).map((s) => s.id) }))
    .filter((m) => m.ids.length > 0);
  const renamed = plan.name !== session.plan_name;

  if (deletes.length) check(await supabase.from('session_sets').delete().in('id', deletes));
  if (moves.length) {
    const results = await Promise.all(
      moves.map((m) => supabase.from('session_sets').update({ exercise_order: m.to }).in('id', m.ids)),
    );
    results.forEach(check);
  }
  if (inserts.length) check(await supabase.from('session_sets').insert(inserts));
  if (renamed) check(await supabase.from('workout_sessions').update({ plan_name: plan.name }).eq('id', session.id));
  saveSnapshot(session.id, plan);

  return deletes.length > 0 || moves.length > 0 || inserts.length > 0 || renamed;
}

export async function getSession(id: string): Promise<SessionWithSets> {
  const row = must(await supabase.from('workout_sessions').select('*, session_sets(*)').eq('id', id).single()) as any;
  return { ...mapSession(row), sets: ((row.session_sets ?? []) as any[]).map(mapSet).sort(bySetOrder) };
}

export function groupSets(sets: SessionSet[]): ExerciseGroup[] {
  const groups = new Map<number, ExerciseGroup>();
  for (const s of [...sets].sort(bySetOrder)) {
    const g = groups.get(s.exercise_order);
    if (g) g.sets.push(s);
    else groups.set(s.exercise_order, { order: s.exercise_order, name: s.exercise_name, sets: [s] });
  }
  return [...groups.values()];
}

export async function updateSet(id: string, patch: SetPatch): Promise<void> {
  check(await supabase.from('session_sets').update(patch).eq('id', id));
}

/** Adds a set to an exercise, copying weight and reps from its last set. */
export async function addSet(sessionId: string, group: ExerciseGroup): Promise<SessionSet> {
  const last = group.sets[group.sets.length - 1];
  const row = must(
    await supabase
      .from('session_sets')
      .insert({
        session_id: sessionId,
        exercise_name: group.name,
        exercise_order: group.order,
        set_number: (last?.set_number ?? 0) + 1,
        reps: last?.reps ?? null,
        weight: last?.weight ?? null,
        weight_unit: last?.weight_unit ?? 'kg',
        per_side: last?.per_side ?? false,
      })
      .select()
      .single(),
  );
  return mapSet(row);
}

/**
 * Switches an exercise between kg, lb and bodyweight: every set's weight is converted
 * (95 lb → 43.1 kg) and the plan remembers the unit for next time.
 */
export async function setExerciseUnit(session: WorkoutSession, group: ExerciseGroup, unit: WeightUnit): Promise<SessionSet[]> {
  const updated = group.sets.map((s) => ({ ...s, weight: convertWeight(s.weight, s.weight_unit, unit), weight_unit: unit }));
  const results = await Promise.all(
    updated.map((s) => supabase.from('session_sets').update({ weight: s.weight, weight_unit: unit }).eq('id', s.id)),
  );
  results.forEach(check);
  if (session.plan_id) {
    check(
      await supabase.from('plan_exercises').update({ weight_unit: unit }).eq('plan_id', session.plan_id).eq('name', group.name),
    );
  }
  return updated;
}

export async function deleteSet(id: string): Promise<void> {
  check(await supabase.from('session_sets').delete().eq('id', id));
}

/** Adds an exercise (with one empty set) to a session that isn't in the plan. */
export async function addSessionExercise(sessionId: string, name: string, order: number): Promise<SessionSet> {
  const row = must(
    await supabase
      .from('session_sets')
      .insert({
        session_id: sessionId,
        exercise_name: name.trim(),
        exercise_order: order,
        set_number: 1,
        // Push-Ups start as bodyweight, dumbbell lifts per hand.
        ...exerciseDefaults(name.trim(), { weight_unit: 'kg', per_side: false }),
      })
      .select()
      .single(),
  );
  return mapSet(row);
}

/**
 * Puts warm-up sets in front of an exercise's working sets: the working sets move down to
 * make room, and the warm-ups start unticked with the suggested weights and reps.
 */
export async function addWarmups(
  sessionId: string,
  group: ExerciseGroup,
  warmups: { weight: number; reps: number }[],
): Promise<SessionSet[]> {
  const k = warmups.length;
  const first = group.sets[0];
  const moved = group.sets.map((s) => ({ ...s, set_number: s.set_number + k }));
  const results = await Promise.all(
    moved.map((s) => supabase.from('session_sets').update({ set_number: s.set_number }).eq('id', s.id)),
  );
  results.forEach(check);
  const rows = must(
    await supabase
      .from('session_sets')
      .insert(
        warmups.map((w, i) => ({
          session_id: sessionId,
          exercise_name: group.name,
          exercise_order: group.order,
          set_number: i + 1,
          reps: w.reps,
          weight: w.weight,
          weight_unit: first?.weight_unit ?? 'kg',
          per_side: first?.per_side ?? false,
          set_type: 'warmup',
        })),
      )
      .select(),
  ) as any[];
  return [...rows.map(mapSet), ...moved];
}

/** An empty workout for today that isn't tied to a plan; exercises are added as you go. */
export async function startQuickSession(): Promise<string> {
  const row = must(
    await supabase.from('workout_sessions').insert({ plan_id: null, plan_name: 'Quick Workout' }).select('id').single(),
  ) as { id: string };
  return row.id;
}

/**
 * Turns a plan-less workout into a plan with the same exercises, set counts and rep range,
 * and links the workout to it. Returns the new plan's id.
 */
export async function saveSessionAsPlan(session: SessionWithSets): Promise<string> {
  const exercises = groupSets(session.sets).map((g) => {
    const working = g.sets.filter((s) => s.set_type !== 'warmup');
    const reps = working.map((s) => s.reps ?? 0).filter((r) => r > 0);
    const min = reps.length ? Math.min(...reps) : 10;
    const max = reps.length ? Math.max(...reps) : 10;
    return {
      name: g.name,
      target_sets: Math.max(1, Math.min(20, working.length)),
      target_reps: Math.max(1, Math.min(100, min)),
      target_reps_max: max > min ? Math.min(100, max) : null,
      target_weight: null,
      rest_seconds: null,
      weight_unit: g.sets[0]?.weight_unit ?? 'kg',
      per_side: g.sets[0]?.per_side ?? false,
    };
  });
  const planId = await savePlan(null, { name: session.plan_name, days: [], exercises });
  check(await supabase.from('workout_sessions').update({ plan_id: planId }).eq('id', session.id));
  return planId;
}

/** Marks a session finished. Unticked sets stay so the workout can be reopened and completed later. */
export async function finishSession(id: string): Promise<string> {
  const completedAt = new Date().toISOString();
  check(await supabase.from('workout_sessions').update({ completed_at: completedAt }).eq('id', id));
  return completedAt;
}

export async function reopenSession(id: string): Promise<void> {
  check(await supabase.from('workout_sessions').update({ completed_at: null }).eq('id', id));
}

/**
 * Puts a deleted workout back exactly as it was (same id, times, notes and sets), for Undo.
 * If its plan has been deleted since, the workout comes back without a plan, like history does.
 */
export async function restoreSession(snapshot: SessionWithSets): Promise<void> {
  const row = {
    id: snapshot.id,
    plan_name: snapshot.plan_name,
    started_at: snapshot.started_at,
    completed_at: snapshot.completed_at,
    notes: snapshot.notes,
  };
  let res = await supabase.from('workout_sessions').insert({ ...row, plan_id: snapshot.plan_id });
  if (res.error && snapshot.plan_id) res = await supabase.from('workout_sessions').insert({ ...row, plan_id: null });
  check(res);
  if (snapshot.sets.length > 0) {
    check(
      await supabase.from('session_sets').insert(
        snapshot.sets.map((x) => ({
          id: x.id,
          session_id: snapshot.id,
          exercise_name: x.exercise_name,
          exercise_order: x.exercise_order,
          set_number: x.set_number,
          reps: x.reps,
          weight: x.weight,
          rpe: x.rpe,
          completed: x.completed,
          weight_unit: x.weight_unit,
          per_side: x.per_side,
        set_type: x.set_type,
        })),
      ),
    );
  }
}

export async function deleteSession(id: string): Promise<void> {
  check(await supabase.from('workout_sessions').delete().eq('id', id));
  dropSnapshot(id);
}

/** Sessions started on or after `since` (newest first). */
export async function listSessionsSince(since: Date): Promise<WorkoutSession[]> {
  const rows = must(
    await supabase
      .from('workout_sessions')
      .select('*')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false }),
  ) as any[];
  return rows.map(mapSession);
}

/** Most recent unfinished session (any day), so the user can resume it. */
export async function getActiveSession(): Promise<WorkoutSession | null> {
  const rows = must(
    await supabase
      .from('workout_sessions')
      .select('*')
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1),
  ) as any[];
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function countCompletedSessions(since?: Date): Promise<number> {
  let q = supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .not('completed_at', 'is', null);
  if (since) q = q.gte('started_at', since.toISOString());
  const res = await q;
  check(res);
  return res.count ?? 0;
}

export async function listHistory(limit = 100): Promise<HistoryItem[]> {
  const rows = must(
    await supabase
      .from('workout_sessions')
      .select('*, session_sets(*)')
      .order('started_at', { ascending: false })
      .limit(limit),
  ) as any[];
  return rows.map((r) => {
    const sets = ((r.session_sets ?? []) as any[]).map(mapSet);
    const done = sets.filter((s) => s.completed);
    return {
      ...mapSession(r),
      totalSets: sets.length,
      completedSets: done.length,
      volume: done.reduce((sum, s) => sum + setVolumeKg(s), 0),
      exercises: groupSets(done).map((g) => ({ name: g.name, summary: g.sets.map((s) => formatSet(s)).join(' · ') })),
    };
  });
}
