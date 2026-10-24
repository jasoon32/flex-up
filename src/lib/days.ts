import { locale, strings } from '@/i18n';
import type { DayOfWeek } from './types';

/** Display order: Monday first. */
export const WEEK_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export function today(): DayOfWeek {
  return new Date().getDay() as DayOfWeek;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday 00:00 of the current week. */
export function startOfWeek(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** The date of weekday `d` in the current Monday–Sunday week. */
export function dateThisWeek(d: DayOfWeek): Date {
  const date = startOfWeek();
  date.setDate(date.getDate() + WEEK_ORDER.indexOf(d));
  return date;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Thursday, 23 Oct" / "10月23日星期四" */
export function formatLongDate(d: Date): string {
  return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(startIso: string, endIso: string): string {
  const u = strings().units;
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (mins < 60) return u.minutes(mins);
  return u.hoursMinutes(Math.floor(mins / 60), mins % 60);
}
