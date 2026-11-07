import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { currentLang, strings } from '@/i18n';

/**
 * The AI coach. Every call goes through the `ai` Supabase Edge Function, which holds the
 * Gemini key and counts each request toward the person's daily cap.
 */

export interface AiResults {
  recap: { text: string };
  swap: { options: { name: string; why: string }[] };
  plateau: { tip: string };
  weekly: WeeklyReport;
}

export interface WeeklyReport {
  title: string;
  highlights: string[];
  focus: string;
}

export type AiKind = keyof AiResults;

/** Why the coach didn't answer: out of today's AI, Gemini's free limit was hit, or anything else. */
export class AiError extends Error {
  constructor(public reason: 'limit' | 'busy' | 'failed') {
    const A = strings().ai;
    super(reason === 'limit' ? A.limit : reason === 'busy' ? A.busy : A.failed);
  }
}

export async function askAi<K extends AiKind>(kind: K, data: unknown): Promise<AiResults[K]> {
  const { data: out, error } = await supabase.functions.invoke('ai', { body: { kind, lang: currentLang(), data } });
  if (error) {
    let code: string | undefined;
    if (error instanceof FunctionsHttpError) {
      code = await error.context
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
    }
    throw new AiError(code === 'limit' ? 'limit' : code === 'busy' ? 'busy' : 'failed');
  }
  return out as AiResults[K];
}

/** The message to show for a failed AI call. */
export const aiErrorText = (e: unknown) => (e instanceof AiError ? e.message : strings().ai.failed);

const cacheKey = (key: string) => `flexup.ai.${key}`;

/** A small per-device cache so the same tip isn't asked for twice. */
export function readAiCache<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(cacheKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeAiCache(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(cacheKey(key), JSON.stringify(value));
  } catch {
    // Cache is a nicety; without it the coach is just asked again.
  }
}
