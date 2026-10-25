import { loadHistory } from '@/data/progress';
import { setVolumeKg } from './units';
import { shareBytes, type ShareResult } from './shareImage';

const cell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Every ticked set from every finished workout, one row each, in a spreadsheet-friendly CSV
 * (the same shape Strong and Hevy export, so it can be opened in Excel or Google Sheets).
 */
export async function exportWorkoutsCsv(title: string): Promise<ShareResult> {
  const { sessions, sets } = await loadHistory();
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const header = ['Date', 'Time', 'Workout', 'Exercise', 'Set', 'Type', 'Weight', 'Unit', 'Reps', 'Per hand', 'Volume (kg)'];
  const rows = sets
    .map((s) => ({ s, session: byId.get(s.session_id)! }))
    .sort(
      (a, b) =>
        a.session.started_at.localeCompare(b.session.started_at) ||
        a.s.exercise_name.localeCompare(b.s.exercise_name) ||
        a.s.set_number - b.s.set_number,
    )
    .map(({ s, session }) => {
      const d = new Date(session.started_at);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return [
        date,
        time,
        session.plan_name,
        s.exercise_name,
        s.set_number,
        s.set_type,
        s.weight,
        s.weight_unit === 'bw' ? 'bodyweight' : s.weight_unit,
        s.reps,
        s.per_side ? 'yes' : 'no',
        Math.round(setVolumeKg(s) * 10) / 10,
      ];
    });
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  // A byte-order mark makes Excel read the Chinese and other non-English names correctly.
  const bytes = new TextEncoder().encode(`﻿${csv}\n`);
  return shareBytes(bytes, 'flex-up-workouts.csv', 'text/csv', 'public.comma-separated-values-text', title);
}
