import { useSyncExternalStore } from 'react';
import { UNIT_STEPS } from './units';

/** Device-only workout preferences, remembered like the language setting. */
export interface Prefs {
  /** Rest in seconds for exercises without their own rest time. */
  defaultRest: number;
  showRpe: boolean;
  /** How much each − / + tap changes the weight, for kg and for lb exercises. */
  weightStep: number;
  weightStepLb: number;
}

export const REST_CHOICES = [60, 90, 120, 180] as const;
export const WEIGHT_STEPS = UNIT_STEPS.kg;

const STORAGE_KEY = 'flexup.prefs';
const DEFAULTS: Prefs = { defaultRest: 90, showRpe: false, weightStep: 2.5, weightStepLb: 5 };

function readSaved(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Prefs>;
    return {
      defaultRest: typeof raw.defaultRest === 'number' ? raw.defaultRest : DEFAULTS.defaultRest,
      showRpe: typeof raw.showRpe === 'boolean' ? raw.showRpe : DEFAULTS.showRpe,
      weightStep: WEIGHT_STEPS.includes(raw.weightStep as never) ? raw.weightStep! : DEFAULTS.weightStep,
      weightStepLb: UNIT_STEPS.lb.includes(raw.weightStepLb as never) ? raw.weightStepLb! : DEFAULTS.weightStepLb,
    };
  } catch {
    return DEFAULTS;
  }
}

let current = readSaved();
const listeners = new Set<() => void>();

export function setPrefs(change: Partial<Prefs>) {
  current = { ...current, ...change };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Not persisted; the choice still applies for this launch.
  }
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePrefs = (): Prefs => useSyncExternalStore(subscribe, () => current);
