import { strings } from '@/i18n';

type QueryError = { message: string; code?: string } | null;

/** Turns raw Supabase / network errors into something a user can act on. */
export function friendlyMessage(raw: string, code?: string): string {
  const e = strings().errors;
  const msg = raw.toLowerCase();
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) return e.noConnection;
  if (msg.includes('jwt') || msg.includes('not authenticated')) return e.sessionExpired;
  if (code === '23514' || msg.includes('violates check constraint')) return e.outOfRange;
  if (code === '42501' || msg.includes('row-level security')) return e.noAccess;
  if (code === 'PGRST116') return e.gone;
  if (code === 'PGRST205' || msg.includes('schema cache')) return e.dbNotSetUp;
  return raw;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return friendlyMessage(e.message);
  if (typeof e === 'string') return friendlyMessage(e);
  return strings().errors.generic;
}

/** Throws on error, returns data (which must be present). */
export function must<T>(res: { data: T | null; error: QueryError }): T {
  if (res.error) throw new Error(friendlyMessage(res.error.message, res.error.code));
  if (res.data === null) throw new Error(strings().errors.noData);
  return res.data;
}

/** Throws on error; for writes that return no rows. */
export function check(res: { error: QueryError }): void {
  if (res.error) throw new Error(friendlyMessage(res.error.message, res.error.code));
}
