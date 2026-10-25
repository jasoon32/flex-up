import { supabase } from '@/lib/supabase';
import { check, must } from '@/lib/errors';

/** Sticky notes ("seat on 4") for the given exercises. */
export async function getExerciseNotes(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();
  const rows = must(
    await supabase.from('exercise_notes').select('exercise_name, note').in('exercise_name', names),
  ) as { exercise_name: string; note: string }[];
  return new Map(rows.map((r) => [r.exercise_name, r.note]));
}

/** Saves an exercise's note; an empty note removes it. */
export async function saveExerciseNote(name: string, note: string): Promise<void> {
  const text = note.trim();
  if (!text) {
    check(await supabase.from('exercise_notes').delete().eq('exercise_name', name));
    return;
  }
  check(
    await supabase
      .from('exercise_notes')
      .upsert({ exercise_name: name, note: text, updated_at: new Date().toISOString() }, { onConflict: 'user_id,exercise_name' }),
  );
}

/** The workout's own note ("felt strong, slept 8h"). */
export async function saveWorkoutNote(sessionId: string, note: string): Promise<void> {
  check(await supabase.from('workout_sessions').update({ notes: note.trim() || null }).eq('id', sessionId));
}
