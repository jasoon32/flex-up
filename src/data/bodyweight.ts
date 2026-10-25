import { supabase } from '@/lib/supabase';
import { check, must } from '@/lib/errors';
import { LB_TO_KG } from '@/lib/units';

export interface BodyWeight {
  id: string;
  /** "2026-10-25" */
  logged_on: string;
  weight: number;
  unit: 'kg' | 'lb';
}

export const bodyWeightKg = (b: Pick<BodyWeight, 'weight' | 'unit'>) => (b.unit === 'lb' ? b.weight * LB_TO_KG : b.weight);

/** Every logged body weight, oldest first. */
export async function listBodyWeights(): Promise<BodyWeight[]> {
  const rows = must(
    await supabase.from('body_weights').select('id, logged_on, weight, unit').order('logged_on', { ascending: true }),
  ) as any[];
  return rows.map((r) => ({ id: r.id, logged_on: r.logged_on, weight: Number(r.weight), unit: r.unit === 'lb' ? 'lb' : 'kg' }));
}

/** Logs a weight for a day; logging the same day again replaces it. */
export async function logBodyWeight(weight: number, unit: 'kg' | 'lb', day: string): Promise<void> {
  check(
    await supabase
      .from('body_weights')
      .upsert({ logged_on: day, weight, unit }, { onConflict: 'user_id,logged_on' }),
  );
}

export async function deleteBodyWeight(id: string): Promise<void> {
  check(await supabase.from('body_weights').delete().eq('id', id));
}
