import { locale, strings } from '@/i18n';
import { LB_TO_KG } from './units';
import type { WeightUnit } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "82.5 kg", "180 lb", or "BW+10" for added weight on a bodyweight move. */
export function formatKg(kg: number, unit: WeightUnit): string {
  if (unit === 'lb') return `${round1(kg / LB_TO_KG).toLocaleString(locale())} lb`;
  if (unit === 'bw') return `${strings().units.bodyweight}+${round1(kg).toLocaleString(locale())}`;
  return `${round1(kg).toLocaleString(locale())} kg`;
}

/** Big volumes read better in tonnes: "12.4 t"; under a tonne stays "850 kg". */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return strings().progress.tonnes(round1(kg / 1000).toLocaleString(locale()));
  return `${Math.round(kg).toLocaleString(locale())} kg`;
}

/** "+2", "−1.5" with a real minus sign; "" for no change. */
export function signed(n: number, digits = 0): string {
  const v = Math.round(n * 10 ** digits) / 10 ** digits;
  if (v === 0) return '';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString(locale())}`;
}

export const shortDate = (d: Date) => d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
