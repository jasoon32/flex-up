import { strings } from '@/i18n';

export type Parsed = { ok: true; value: number | null } | { ok: false; error: string };

interface NumberRule {
  label: string;
  min: number;
  max: number;
  integer?: boolean;
  required?: boolean;
  /** Round to this many decimals (e.g. RPE 7.5). */
  decimals?: number;
}

export function parseNumber(text: string, rule: NumberRule): Parsed {
  const v = strings().validation;
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return rule.required ? { ok: false, error: v.required(rule.label) } : { ok: true, value: null };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: v.notNumber(rule.label) };
  if (rule.integer && !Number.isInteger(n)) return { ok: false, error: v.notWhole(rule.label) };
  if (n < rule.min || n > rule.max) return { ok: false, error: v.range(rule.label, rule.min, rule.max) };
  const factor = 10 ** (rule.decimals ?? 2);
  return { ok: true, value: Math.round(n * factor) / factor };
}

export const parseReps = (t: string, required = false) =>
  parseNumber(t, { label: strings().sets.reps, min: 0, max: 1000, integer: true, required });
export const parseWeight = (t: string) => parseNumber(t, { label: strings().validation.weight, min: 0, max: 2000 });
export const parseRpe = (t: string) => parseNumber(t, { label: 'RPE', min: 1, max: 10, decimals: 1 });

export type RepRange = { ok: true; min: number; max: number | null } | { ok: false; error: string };

/** "8" → 8; "6-8" or "6–8" → 6 to 8. */
export function parseRepRange(text: string): RepRange {
  const label = strings().editor.reps;
  const parts = text.trim().split(/\s*[-–~]\s*/);
  if (parts.length > 2) return { ok: false, error: strings().validation.repRange };
  const rule = { label, min: 1, max: 100, integer: true, required: true };
  const lo = parseNumber(parts[0], rule);
  if (!lo.ok) return lo;
  if (parts.length === 1) return { ok: true, min: lo.value!, max: null };
  const hi = parseNumber(parts[1], rule);
  if (!hi.ok) return hi;
  if (hi.value! < lo.value!) return { ok: false, error: strings().validation.repRange };
  return { ok: true, min: lo.value!, max: hi.value === lo.value ? null : hi.value };
}

export function validateName(name: string, label: string): string | null {
  const v = strings().validation;
  const n = name.trim();
  if (n.length === 0) return v.required(label);
  if (n.length > 60) return v.tooLong(label);
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return strings().auth.invalidEmail;
  return null;
}

export const REST_MIN = 10;
export const REST_MAX = 600;

/** 90 → "1:30". */
export const formatRest = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** "" → null (use the default); "90" → 90; "1:30" → 90. */
export function parseRest(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  const m = /^(?:(\d{1,2}):)?(\d{1,3})$/.exec(trimmed);
  const seconds = m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : NaN;
  if (!m || (m[1] !== undefined && Number(m[2]) > 59) || seconds < REST_MIN || seconds > REST_MAX) {
    return { ok: false, error: strings().validation.rest };
  }
  return { ok: true, value: seconds };
}

/** Display a nullable number as input text. */
export const numText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
