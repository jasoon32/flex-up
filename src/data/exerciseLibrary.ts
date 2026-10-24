import type { Lang } from '@/i18n';
import { EXERCISE_NAMES, PLAN_NAMES, nameIn, type NameKind } from './names';

/** Common gym exercises offered as suggestions while typing an exercise name. */
export const EXERCISE_LIBRARY: string[] = Object.keys(EXERCISE_NAMES);
/** Common workout names and splits offered while typing a plan name. */
export const PLAN_LIBRARY: string[] = Object.keys(PLAN_NAMES);

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9+' 一-鿿]/g, ' ');

/**
 * Up to `limit` saved names (English) for what's been typed: names starting with it first,
 * then names with a word starting with it ("pu" → Push-Up, Pull-Up, Lat Pulldown…). In
 * Chinese the Chinese names are searched too ("卧推" → 杠铃卧推…). Extra names (e.g. the
 * user's own exercises) are searched as well.
 */
export function suggestNames(query: string, kind: NameKind, lang: Lang, extra: string[] = [], limit = 6): string[] {
  const q = normalise(query).trim();
  if (q.length === 0) return [];
  // Gym shorthand: "db" also finds Dumbbell, "bb" Barbell, "kb" Kettlebell.
  const aliases: Record<string, string> = { db: 'dumbbell', bb: 'barbell', kb: 'kettlebell' };
  const queries = [q];
  const first = q.split(' ')[0];
  if (aliases[first]) queries.push(aliases[first] + q.slice(first.length));

  const library = kind === 'plan' ? PLAN_LIBRARY : EXERCISE_LIBRARY;
  const pool = [...new Set([...extra, ...library])];
  const scored: { name: string; score: number }[] = [];
  for (const name of pool) {
    const shown = normalise(nameIn(name, lang, kind));
    if (shown === q) continue; // already typed in full
    let score = -1;
    for (const text of new Set([normalise(name), shown])) {
      const words = text.split(/\s+/);
      for (const query of queries) {
        let s = -1;
        if (text.startsWith(query)) s = 0;
        else if (words.some((w, i) => w.startsWith(query) || words.slice(i).join(' ').startsWith(query))) s = 1;
        else if (text.includes(query)) s = 2;
        if (s >= 0 && (score < 0 || s < score)) score = s;
      }
    }
    if (score >= 0) scored.push({ name, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((s) => s.name);
}
