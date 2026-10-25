/** Plates a typical gym has, heaviest first. */
export const PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
} as const;

export const BARS = {
  kg: [20, 15, 10],
  lb: [45, 35, 25],
} as const;

export interface PlateLoad {
  /** Plates for one side of the bar, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs loaded like this. */
  loaded: number;
  /** Weight that couldn't be made with these plates (target − loaded). */
  leftover: number;
}

/** Which plates go on each side to reach `target` on a `bar`, using the heaviest plates first. */
export function loadBar(target: number, bar: number, unit: 'kg' | 'lb'): PlateLoad {
  let side = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];
  for (const p of PLATES[unit]) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const loaded = bar + 2 * perSide.reduce((t, p) => t + p, 0);
  return { perSide, loaded, leftover: Math.round((target - loaded) * 100) / 100 };
}
