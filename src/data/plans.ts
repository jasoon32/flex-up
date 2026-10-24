import { supabase } from '@/lib/supabase';
import { check, must } from '@/lib/errors';
import { asUnit } from '@/lib/units';
import type { DayOfWeek, DraftExercise, Plan, PlanExercise, PlanWithExercises } from '@/lib/types';

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function mapExercise(row: any): PlanExercise {
  return {
    id: row.id,
    plan_id: row.plan_id,
    name: row.name,
    target_sets: Number(row.target_sets),
    target_reps: Number(row.target_reps),
    target_reps_max: toNum(row.target_reps_max),
    target_weight: toNum(row.target_weight),
    rest_seconds: toNum(row.rest_seconds),
    weight_unit: asUnit(row.weight_unit),
    per_side: !!row.per_side,
    position: Number(row.position),
  };
}

/** "6–8" or "10". */
export function formatReps(e: Pick<PlanExercise, 'target_reps' | 'target_reps_max'>): string {
  return e.target_reps_max && e.target_reps_max > e.target_reps
    ? `${e.target_reps}–${e.target_reps_max}`
    : String(e.target_reps);
}

/** "3 × 6–8" */
export function formatTarget(e: Pick<PlanExercise, 'target_sets' | 'target_reps' | 'target_reps_max'>): string {
  return `${e.target_sets} × ${formatReps(e)}`;
}

function mapPlan(row: any): Plan {
  return { id: row.id, name: row.name, days: (row.days ?? []) as DayOfWeek[], created_at: row.created_at };
}

function mapPlanWithExercises(row: any): PlanWithExercises {
  const exercises = ((row.plan_exercises ?? []) as any[]).map(mapExercise).sort((a, b) => a.position - b.position);
  return { ...mapPlan(row), exercises };
}

export async function listPlans(): Promise<PlanWithExercises[]> {
  const rows = must(
    await supabase
      .from('workout_plans')
      .select('id, name, days, created_at, plan_exercises(*)')
      .order('created_at', { ascending: true }),
  ) as any[];
  return rows.map(mapPlanWithExercises);
}

export async function getPlan(id: string): Promise<PlanWithExercises> {
  return mapPlanWithExercises(
    must(
      await supabase
        .from('workout_plans')
        .select('id, name, days, created_at, plan_exercises(*)')
        .eq('id', id)
        .single(),
    ),
  );
}

/**
 * Creates or updates a plan and syncs its exercise list in one go: removed
 * exercises are deleted, changed ones updated, new ones inserted, and every
 * row's position follows the draft order. Returns the plan id.
 */
export async function savePlan(
  planId: string | null,
  input: { name: string; days: DayOfWeek[]; exercises: DraftExercise[] },
  original: PlanExercise[] = [],
): Promise<string> {
  let id = planId;
  if (id) {
    check(await supabase.from('workout_plans').update({ name: input.name.trim(), days: input.days }).eq('id', id));
  } else {
    const row = must(
      await supabase.from('workout_plans').insert({ name: input.name.trim(), days: input.days }).select('id').single(),
    ) as { id: string };
    id = row.id;
  }

  const kept = new Set(input.exercises.map((e) => e.id).filter(Boolean));
  const removed = original.filter((e) => !kept.has(e.id)).map((e) => e.id);
  if (removed.length > 0) check(await supabase.from('plan_exercises').delete().in('id', removed));

  const byId = new Map(original.map((e) => [e.id, e]));
  const updates = input.exercises
    .map((e, position) => ({ e, position, before: e.id ? byId.get(e.id) : undefined }))
    .filter(
      ({ e, position, before }) =>
        before &&
        (before.name !== e.name.trim() ||
          before.target_sets !== e.target_sets ||
          before.target_reps !== e.target_reps ||
          before.target_reps_max !== e.target_reps_max ||
          before.target_weight !== e.target_weight ||
          before.rest_seconds !== e.rest_seconds ||
          before.weight_unit !== e.weight_unit ||
          before.per_side !== e.per_side ||
          before.position !== position),
    );
  const results = await Promise.all(
    updates.map(({ e, position }) =>
      supabase
        .from('plan_exercises')
        .update({
          name: e.name.trim(),
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_reps_max: e.target_reps_max,
          target_weight: e.target_weight,
          rest_seconds: e.rest_seconds,
          weight_unit: e.weight_unit,
          per_side: e.per_side,
          position,
        })
        .eq('id', e.id!),
    ),
  );
  results.forEach(check);

  const inserts = input.exercises
    .map((e, position) => ({ e, position }))
    .filter(({ e }) => !e.id)
    .map(({ e, position }) => ({
      plan_id: id,
      name: e.name.trim(),
      target_sets: e.target_sets,
      target_reps: e.target_reps,
      target_reps_max: e.target_reps_max,
      target_weight: e.target_weight,
      rest_seconds: e.rest_seconds,
      weight_unit: e.weight_unit,
      per_side: e.per_side,
      position,
    }));
  if (inserts.length > 0) check(await supabase.from('plan_exercises').insert(inserts));

  return id;
}

/** Deletes a plan. Finished workouts stay in history; unfinished ones from this plan are removed. */
export async function deletePlan(id: string): Promise<void> {
  check(await supabase.from('workout_sessions').delete().eq('plan_id', id).is('completed_at', null));
  check(await supabase.from('workout_plans').delete().eq('id', id));
}
