import { bodyFrame, buildSprite, type CharacterLook, type Frame, type Rect } from './character';

/**
 * Animated rep loops for the celebration screen and share cards. The dressed character is
 * drawn into a pixel grid once, then each frame moves body parts (hips drop, arms rise…)
 * and adds the kit, so every outfit animates without extra artwork.
 */
export type Pose = 'stand' | 'flex' | 'squat' | 'lunge' | 'press' | 'bench' | 'pull' | 'pullup' | 'curl';

export const FRAME_COUNT = 6;
export const FRAME_MS = 170;
/** How far into the rep each frame is: 0 = start, 1 = the hardest point. */
const WAVE = [0, 1 / 3, 2 / 3, 1, 2 / 3, 1 / 3];
/** The frame used for still images: the hardest point of the rep. */
export const PEAK_FRAME = 3;

const INK = '#111111';
const BAR = '#BDBDB6';
const PLATE = '#6E6E68';
const RIM = '#C6F432';
const MOUTH = '#7A2232';
const BENCH = '#4A4A45';

type Cells = Map<string, string>;
const key = (x: number, y: number) => `${x},${y}`;

function raster(rects: Rect[]): Cells {
  const c: Cells = new Map();
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) c.set(key(x, y), r.f);
  return c;
}

function paint(c: Cells, x: number, y: number, w: number, h: number, f: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) c.set(key(i, j), f);
}

function each(c: Cells, fn: (x: number, y: number, f: string) => void) {
  for (const [k, f] of c) {
    const [x, y] = k.split(',').map(Number);
    fn(x, y, f);
  }
}

/** Moves every cell; returning null drops it. Later cells win where two land on one spot. */
function remap(c: Cells, fn: (x: number, y: number) => [number, number] | null): Cells {
  const out: Cells = new Map();
  each(c, (x, y, f) => {
    const to = fn(x, y);
    if (to) out.set(key(to[0], to[1]), f);
  });
  return out;
}

/** Back to rectangles, merging runs of one colour along each row. */
function toRects(c: Cells): Rect[] {
  const rows = new Map<number, [number, string][]>();
  each(c, (x, y, f) => {
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push([x, f]);
  });
  const out: Rect[] = [];
  for (const [y, cells] of rows) {
    cells.sort((a, b) => a[0] - b[0]);
    let start = cells[0];
    let w = 1;
    for (let i = 1; i <= cells.length; i++) {
      const cur = cells[i];
      if (cur && cur[1] === start[1] && cur[0] === start[0] + w) {
        w++;
        continue;
      }
      out.push({ x: start[0], y, w, h: 1, f: start[1] });
      if (cur) {
        start = cur;
        w = 1;
      }
    }
  }
  return out;
}

interface Body {
  B: Frame;
  /** Torso left edge and width per row. */
  rows: Record<number, [number, number]>;
  left: number;
  right: number;
  armW: number;
  handsY: number;
  /** Where the upper arm ends (the elbow). */
  elbowY: number;
  upperC: string;
  lowerC: string;
  handC: string;
}

function measure(look: CharacterLook, c: Cells): Body {
  const B = bodyFrame(look);
  const rows: Record<number, [number, number]> = {};
  B.torso.forEach((t) => {
    for (let y = t[1]; y < t[1] + t[3]; y++) rows[y] = [t[0], t[2]];
  });
  const [u] = B.upper;
  const lower = B.lower[0];
  const [h] = B.hands;
  const elbow = B.mid.length ? B.mid[0][1] + B.mid[0][3] : u[1] + u[3];
  return {
    B,
    rows,
    left: rows[8][0],
    right: rows[8][0] + rows[8][1],
    armW: u[2],
    handsY: h[1],
    elbowY: elbow,
    upperC: c.get(key(u[0], u[1])) ?? '#E8B48A',
    lowerC: c.get(key(lower[0], lower[1])) ?? '#E8B48A',
    handC: c.get(key(h[0], h[1])) ?? '#E8B48A',
  };
}

/** Removes both arms (everything beside the torso from the shoulders to the hands). */
function eraseArms(c: Cells, b: Body, fromY = 8) {
  const lastRow = Math.max(...Object.keys(b.rows).map(Number));
  const hips = b.B.hips;
  each(c, (x, y) => {
    if (y < fromY || y > b.handsY) return;
    const [l, w] = b.rows[y] ?? (y > lastRow ? [hips[0], hips[2]] : b.rows[lastRow]);
    if (x < l || x >= l + w) c.delete(key(x, y));
  });
}

function barbell(c: Cells, y: number, bend: boolean) {
  const d = bend ? 1 : 0;
  paint(c, 4, y, 12, 1, BAR);
  paint(c, 0, y + d, 4, 1, BAR);
  paint(c, 16, y + d, 4, 1, BAR);
  paint(c, 0, y - 2 + d, 2, 5, PLATE);
  paint(c, 18, y - 2 + d, 2, 5, PLATE);
  paint(c, 1, y - 2 + d, 1, 5, RIM);
  paint(c, 18, y - 2 + d, 1, 5, RIM);
}

function dumbbell(c: Cells, x: number, w: number, y: number) {
  paint(c, x - 1, y, w + 2, 1, BAR);
  paint(c, x - 1, y - 1, 1, 3, PLATE);
  paint(c, x + w, y - 1, 1, 3, PLATE);
}

/** Squats and deadlifts: the upper body drops by `d`, the legs fold and the knees push out. */
function sink(c: Cells, d: number, kneesOut: 'both' | 'left'): Cells {
  if (d === 0) return new Map(c);
  return remap(c, (x, y) => {
    if (y < 21) return [x, y + d];
    if (y > 27) return [x, y];
    const ny = 21 + d + Math.floor(((y - 21) * (7 - d)) / 7);
    const mid = d >= 2 && ny > 21 + d && ny < 27;
    if (mid && x < 10) return [x - 1, ny];
    if (mid && x >= 10 && kneesOut === 'both') return [x + 1, ny];
    return [x, ny];
  });
}

/** Builds the frames of a rep loop. Stand has a single frame. */
export function poseFrames(look: CharacterLook, pose: Pose, heavy = false): Rect[][] {
  if (pose === 'stand') return [buildSprite(look)];
  return WAVE.map((a, i) => toRects(drawFrame(look, pose, a, i === PEAK_FRAME, heavy)));
}

function drawFrame(look: CharacterLook, pose: Pose, a: number, strain: boolean, heavy: boolean): Cells {
  const base = raster(buildSprite(look));
  const b = measure(look, base);
  const B = b.B;
  if (strain) {
    // Effort face: brows down, mouth open.
    base.set(key(8, 3), INK);
    base.set(key(11, 3), INK);
    paint(base, 9, 6, 2, 1, MOUTH);
  }
  const lx = b.left - b.armW;
  const rx = b.right;
  const bend = heavy && a > 0.5;

  switch (pose) {
    case 'squat': {
      const d = Math.round(4 * a);
      eraseArms(base, b);
      const c = sink(base, d, 'both');
      barbell(c, 8 + d, bend);
      // Hands grip the bar beside the shoulders, elbows down.
      [lx, rx].forEach((x) => {
        paint(c, x, 8 + d, b.armW, 1, b.handC);
        paint(c, x, 9 + d, b.armW, 3, b.upperC);
      });
      return c;
    }
    case 'lunge': {
      const d = Math.round(3 * a);
      const c = sink(base, d, 'left');
      B.hands.forEach((h) => dumbbell(c, h[0], h[2], h[1] + d));
      return c;
    }
    case 'pull': {
      // Deadlift: from the floor (a = 1) to standing tall; arms stay straight.
      const d = Math.round(4 * a);
      const c = sink(base, d, 'both');
      const hy = b.handsY + d;
      B.hands.forEach((h) => {
        paint(c, h[0], hy, h[2], d, b.lowerC);
        paint(c, h[0], hy + d, h[2], 1, b.handC);
      });
      barbell(c, hy + d, bend);
      return c;
    }
    case 'press': {
      const barY = Math.round(7 - 8 * a);
      eraseArms(base, b);
      [lx, rx].forEach((x) => {
        for (let y = barY + 1; y <= 10; y++) paint(base, x, y, b.armW, 1, y >= 8 ? b.upperC : b.lowerC);
        paint(base, x, barY, b.armW, 1, b.handC);
      });
      barbell(base, barY, bend);
      return base;
    }
    case 'curl': {
      eraseArms(base, b, b.elbowY);
      const top = b.elbowY - 3;
      const hy = Math.round(b.handsY - a * (b.handsY - top));
      B.lower.forEach((low, i) => {
        const [x, , w] = low;
        if (hy >= b.elbowY) paint(base, x, b.elbowY, w, hy - b.elbowY, b.lowerC);
        else paint(base, x, hy + 1, w, b.elbowY - hy - 1, b.lowerC);
        const hand = B.hands[i];
        paint(base, hand[0], hy, hand[2], 1, b.handC);
        dumbbell(base, hand[0], hand[2], hy);
      });
      return base;
    }
    case 'pullup': {
      const u = Math.round(8 * a);
      eraseArms(base, b);
      const c = remap(base, (x, y) => [x, y - u]);
      const barY = -2;
      [lx, rx].forEach((x) => {
        for (let y = barY + 1; y <= 9 - u; y++) paint(c, x, y, b.armW, 1, y >= 8 - u ? b.upperC : b.lowerC);
        paint(c, x, barY, b.armW, 1, b.handC);
      });
      paint(c, -1, barY, 22, 1, BAR);
      paint(c, -1, barY + 1, 1, 32, PLATE);
      paint(c, 20, barY + 1, 1, 32, PLATE);
      return c;
    }
    case 'bench': {
      // Lying on a bench (head left), pressing the bar up from the chest.
      eraseArms(base, b);
      const c = remap(base, (x, y) => [y + 2, 19 - x]);
      let bottom = 0;
      each(c, (_x, y) => (bottom = Math.max(bottom, y)));
      paint(c, 4, bottom + 1, 21, 2, BENCH);
      paint(c, 6, bottom + 3, 2, 4, BENCH);
      paint(c, 21, bottom + 3, 2, 4, BENCH);
      const chest = 19 - b.right + 1;
      const ax = 10;
      const len = Math.round(1 + 5 * a);
      const hy = chest - len;
      paint(c, ax, hy + 1, b.armW, len - 1, b.lowerC);
      paint(c, ax, hy, b.armW, 1, b.handC);
      paint(c, ax - 1, hy - 4, b.armW + 2, 4, PLATE);
      paint(c, ax - 1, hy - 4, b.armW + 2, 1, RIM);
      return c;
    }
    case 'flex': {
      if (a < 0.5) return base;
      eraseArms(base, b);
      [
        [b.left - 3, b.left - 3],
        [b.right, b.right + 1],
      ].forEach(([armX, foreX], side) => {
        paint(base, armX, 8, 3, 2, b.upperC);
        paint(base, foreX, 4, 2, 4, b.lowerC);
        paint(base, foreX, 3, 2, 1, b.handC);
        // The bicep peaks on the hardest frame.
        if (strain) paint(base, side === 0 ? b.left - 1 : b.right, 7, 1, 1, b.upperC);
      });
      return base;
    }
    default:
      return base;
  }
}

/** The box every frame fits in, so the loop doesn't jump around. */
export function framesBounds(frames: Rect[][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of frames)
    for (const r of f) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Picks the pose from the plan name, then from what most exercises look like. */
export function poseFor(planName: string, exercises: string[]): Pose {
  const rules: [Pose, RegExp][] = [
    ['pullup', /pull-?ups?|chin-?ups?|引体/i],
    ['bench', /bench|chest|pec|卧推|胸/i],
    ['lunge', /lunge|split squat|弓步/i],
    ['squat', /leg|squat|lower|calf|glute|quad|hamstring|腿|深蹲/i],
    ['pull', /pull|back|row|lat|deadlift|背|拉/i],
    ['press', /push|press|shoulder|overhead|upper|dip|推|肩/i],
    ['curl', /arm|curl|bicep|tricep|手臂|二头|三头/i],
  ];
  for (const [pose, re] of rules) if (re.test(planName)) return pose;
  let best: Pose = 'flex';
  let most = 0;
  for (const [pose, re] of rules) {
    const n = exercises.filter((e) => re.test(e)).length;
    if (n > most) {
      best = pose;
      most = n;
    }
  }
  return best;
}

/** A heavy day bends the bar: any completed set at 100 kg or more. */
export const isHeavy = (weights: (number | null)[]) => weights.some((w) => (w ?? 0) >= 100);
