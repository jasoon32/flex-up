import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { check } from '@/lib/errors';

/**
 * Character options from the "Wardrobe" and "Gym-wear catalog" boards of the design canvas.
 * Every item is drawn in code on the same 20-wide pixel grid, on top of the body.
 */
export const GENDERS = ['M', 'F'] as const;
export const BODIES = ['lean', 'buff', 'heavy'] as const;

const SK = '#E8B48A';
const SS = '#C98F66';
const HAIR = '#4A3A2E';
const INK = '#111111';
const WH = '#F4F4F0';

export type Box = [number, number, number, number];
export interface Frame {
  head: [number, number];
  neck: [number, number, number, number, string][];
  torso: Box[];
  upper: Box[];
  mid: Box[];
  lower: Box[];
  hands: Box[];
  hips: Box;
  legs: Box[];
}

const FRAMES: Record<Gender, Record<Body, Frame>> = {
  M: {
    lean: { head: [7, 6], neck: [[9, 7, 2, 1, SK]], torso: [[7, 8, 6, 9]], upper: [[5, 8, 2, 4], [13, 8, 2, 4]], mid: [], lower: [[5, 12, 2, 4], [13, 12, 2, 4]], hands: [[5, 16, 2, 1], [13, 16, 2, 1]], hips: [7, 17, 6, 4], legs: [[7, 21, 2, 7], [11, 21, 2, 7]] },
    buff: { head: [7, 6], neck: [[7, 7, 6, 1, SS]], torso: [[6, 8, 8, 3], [5, 11, 10, 3], [6, 14, 8, 3]], upper: [[3, 8, 3, 3], [14, 8, 3, 3]], mid: [[2, 11, 3, 3], [15, 11, 3, 3]], lower: [[2, 14, 2, 3], [16, 14, 2, 3]], hands: [[2, 17, 2, 1], [16, 17, 2, 1]], hips: [5, 17, 10, 4], legs: [[5, 21, 4, 7], [11, 21, 4, 7]] },
    heavy: { head: [6, 8], neck: [[7, 7, 6, 1, SS]], torso: [[5, 8, 10, 3], [3, 11, 14, 6], [4, 17, 12, 1]], upper: [[3, 8, 2, 3], [15, 8, 2, 3]], mid: [], lower: [[1, 11, 2, 5], [17, 11, 2, 5]], hands: [[1, 16, 2, 1], [17, 16, 2, 1]], hips: [5, 18, 10, 3], legs: [[5, 21, 4, 7], [11, 21, 4, 7]] },
  },
  F: {
    lean: { head: [7, 6], neck: [[9, 7, 2, 1, SK]], torso: [[7, 8, 6, 4], [8, 12, 4, 3], [7, 15, 6, 2]], upper: [[5, 8, 2, 4], [13, 8, 2, 4]], mid: [], lower: [[5, 12, 2, 4], [13, 12, 2, 4]], hands: [[5, 16, 2, 1], [13, 16, 2, 1]], hips: [6, 17, 8, 4], legs: [[7, 21, 2, 7], [11, 21, 2, 7]] },
    buff: { head: [7, 6], neck: [[9, 7, 2, 1, SK]], torso: [[6, 8, 8, 4], [7, 12, 6, 2], [6, 14, 8, 3]], upper: [[4, 8, 2, 3], [14, 8, 2, 3]], mid: [[3, 11, 2, 3], [15, 11, 2, 3]], lower: [[3, 14, 2, 3], [15, 14, 2, 3]], hands: [[3, 17, 2, 1], [15, 17, 2, 1]], hips: [5, 17, 10, 4], legs: [[6, 21, 3, 7], [11, 21, 3, 7]] },
    heavy: { head: [6, 8], neck: [[8, 7, 4, 1, SS]], torso: [[5, 8, 10, 3], [4, 11, 12, 6], [4, 17, 12, 1]], upper: [[3, 8, 2, 3], [15, 8, 2, 3]], mid: [], lower: [[2, 11, 2, 5], [16, 11, 2, 5]], hands: [[2, 16, 2, 1], [16, 16, 2, 1]], hips: [4, 18, 12, 3], legs: [[5, 21, 4, 7], [11, 21, 4, 7]] },
  },
};

interface TopDef {
  c: string;
  s: string;
  /** Which arm parts the sleeves cover. */
  sleeves?: 'upper' | 'arm' | 'full';
  sleeveC?: string;
  /** Tank straps: columns trimmed off each side over the first `cut` rows. */
  narrow?: number;
  cut?: number;
  /** Ends after this row (crop top, sports bra). */
  rows?: number;
  oversized?: boolean;
  longer?: number;
  hood?: boolean;
  strings?: boolean;
  zip?: string;
  pocket?: boolean;
  rib?: boolean;
  band?: string;
  bib?: boolean;
  logo?: string;
  pattern?: 'tiedye';
  womens?: boolean;
}

interface BottomDef {
  c: string;
  s: string;
  /** How many rows down the legs it reaches (0 = hips only, 7 = ankles). */
  legs: number;
  baggy?: boolean;
  stripe?: string;
  /** Stripe on the legs only, not the hips. */
  legStripeOnly?: boolean;
  flare?: boolean;
  cuff?: boolean;
  pockets?: boolean;
  tights?: string;
  skirt?: boolean;
  pattern?: 'camo';
  womens?: boolean;
}

interface ShoeDef {
  c: string;
  sole: string | null;
  high?: number;
  accent?: string;
  socks?: string;
}

interface SockDef {
  c: string;
  from: number;
  stripe?: string;
}

const HEAD = ['cap', 'beanie', 'headband', 'snapback', 'backwards', 'bucket', 'visor', 'bandana', 'durag'] as const;
const AUDIO = ['earbuds', 'headphones'] as const;

const TOPS = {
  tank: { c: '#C6F432', s: '#9CC21F' },
  tee: { c: '#2E4A9E', s: '#233A7E', sleeves: 'upper' },
  hoodie: { c: '#F07D2C', s: '#C9631C', sleeves: 'full', hood: true, pocket: true, strings: true },
  stringer: { c: '#1A1A1A', s: '#3A3A36', narrow: 1, cut: 5 },
  muscle: { c: '#8F8F88', s: '#6E6E68', narrow: 1, cut: 3 },
  pump: { c: '#4A4A45', s: '#35352F', sleeves: 'arm', oversized: true, longer: 2 },
  complong: { c: '#1A1A1A', s: '#3A3A36', sleeves: 'full' },
  comptee: { c: '#33415C', s: '#253047', sleeves: 'upper' },
  crop: { c: '#FFFFFF', s: '#DADAD2', sleeves: 'upper', rows: 12 },
  sportsbra: { c: '#F27BAA', s: '#D45C8C', narrow: 1, cut: 4, rows: 11, womens: true },
  ziphoodie: { c: '#A7A7A0', s: '#8A8A83', sleeves: 'full', hood: true, zip: '#E6E6DE', pocket: true },
  crewneck: { c: '#7A2232', s: '#5E1926', sleeves: 'full', rib: true },
  windbreaker: { c: '#1E8C86', s: '#166A65', sleeves: 'full', band: WH },
  raglan: { c: '#F4F4F0', s: '#D6D6CF', sleeves: 'upper', sleeveC: '#1A1A1A' },
  singlet: { c: '#D64545', s: '#A83434', narrow: 1, cut: 3, bib: true },
  tiedye: { c: '#F2A3C7', s: '#C985A6', sleeves: 'upper', pattern: 'tiedye' },
  graphic: { c: '#1A1A1A', s: '#3A3A36', sleeves: 'upper', logo: '#C6F432' },
} satisfies Record<string, TopDef>;

const BOTTOMS = {
  shorts: { c: '#3A3A36', s: '#3A3A36', legs: 0 },
  joggers: { c: '#8F8F88', s: '#6E6E68', legs: 7, cuff: true },
  track: { c: '#1F2A44', s: '#1F2A44', legs: 7, stripe: WH, legStripeOnly: true },
  s5: { c: '#2E4A9E', s: '#233A7E', legs: 0 },
  s7: { c: '#D64545', s: '#A83434', legs: 1 },
  bball: { c: '#6A3FA0', s: '#522F7D', legs: 3, baggy: true, stripe: WH },
  bike: { c: '#1A1A1A', s: '#3A3A36', legs: 3 },
  leggings: { c: '#1A1A1A', s: '#3A3A36', legs: 7 },
  camo: { c: '#5C6B3A', s: '#46522C', legs: 7, pattern: 'camo' },
  flare: { c: '#3D2F5C', s: '#2E2346', legs: 7, flare: true },
  sweats: { c: '#A7A7A0', s: '#8A8A83', legs: 7, cuff: true, baggy: true },
  cargo: { c: '#5E6B45', s: '#48523A', legs: 7, cuff: true, pockets: true },
  wideleg: { c: '#D8C9A8', s: '#BFAF8C', legs: 7, baggy: true, flare: true },
  overtights: { c: '#2F5BFF', s: '#1E44D6', legs: 1, tights: '#1A1A1A' },
  skort: { c: '#FFFFFF', s: '#DADAD2', legs: 2, skirt: true, womens: true },
} satisfies Record<string, BottomDef>;

const SHOES = {
  whitetr: { c: '#FFFFFF', sole: '#3A3A36', accent: '#2F5BFF' },
  chucks: { c: '#1A1A1A', sole: WH, high: 1 },
  olylift: { c: WH, sole: '#D64545', accent: '#D64545' },
  runners: { c: '#C6F432', sole: WH, accent: '#111111' },
  hightop: { c: '#D64545', sole: WH, high: 2, accent: WH },
  slides: { c: '#1A1A1A', sole: '#1A1A1A', socks: WH },
  minimal: { c: '#6E6E68', sole: null },
  cross: { c: '#2F5BFF', sole: WH, accent: WH },
} satisfies Record<string, ShoeDef>;

const SOCKS = {
  crewW: { c: WH, from: 25 },
  crewB: { c: '#1A1A1A', from: 25 },
  knee: { c: WH, stripe: '#D64545', from: 21 },
} satisfies Record<string, SockDef>;

const GEAR = ['belt', 'wraps', 'knees', 'gloves', 'towel'] as const;

export type Gender = (typeof GENDERS)[number];
export type Body = (typeof BODIES)[number];
export type HeadId = (typeof HEAD)[number];
export type AudioId = (typeof AUDIO)[number];
export type TopId = keyof typeof TOPS;
export type BottomId = keyof typeof BOTTOMS;
export type ShoeId = keyof typeof SHOES;
export type SockId = keyof typeof SOCKS;
export type GearId = (typeof GEAR)[number];
export type ItemId = HeadId | AudioId | TopId | BottomId | ShoeId | SockId | GearId;


export interface CharacterLook {
  name: string;
  gender: Gender;
  body: Body;
  head: HeadId | null;
  audio: AudioId | null;
  top: TopId;
  bottom: BottomId;
  shoes: ShoeId | null;
  socks: SockId | null;
  /** Training gear stacks: any number can be worn at once. */
  gear: GearId[];
}

export type Slot = 'head' | 'audio' | 'top' | 'bottom' | 'shoes' | 'socks' | 'gear';

/** Catalog order; the top and bottom are always worn, everything else can be taken off. */
export const CATALOG: { slot: Slot; items: readonly ItemId[]; optional: boolean }[] = [
  { slot: 'head', items: HEAD, optional: true },
  { slot: 'audio', items: AUDIO, optional: true },
  { slot: 'top', items: Object.keys(TOPS) as TopId[], optional: false },
  { slot: 'bottom', items: Object.keys(BOTTOMS) as BottomId[], optional: false },
  { slot: 'shoes', items: Object.keys(SHOES) as ShoeId[], optional: true },
  { slot: 'socks', items: Object.keys(SOCKS) as SockId[], optional: true },
  { slot: 'gear', items: GEAR, optional: true },
];

export const ITEM_COUNT = CATALOG.reduce((n, c) => n + c.items.length, 0);

/** Items cut for women; their catalog cards always show the female character. */
export const isWomens = (id: ItemId) =>
  !!((TOPS as Record<string, TopDef>)[id]?.womens || (BOTTOMS as Record<string, BottomDef>)[id]?.womens);

export const DEFAULT_LOOK: CharacterLook = {
  name: '',
  gender: 'M',
  body: 'lean',
  head: null,
  audio: null,
  top: 'tank',
  bottom: 'shorts',
  shoes: null,
  socks: null,
  gear: [],
};

/** A plain outfit wearing only `id`, for catalog cards. */
export function lookWith(base: CharacterLook, slot: Slot, id: ItemId): CharacterLook {
  const plain: CharacterLook = { ...DEFAULT_LOOK, gender: isWomens(id) ? 'F' : base.gender, body: base.body };
  if (slot === 'gear') return { ...plain, gear: [id as GearId] };
  return { ...plain, [slot]: id };
}

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;
const pickOrNull = <T extends string>(list: readonly T[], v: unknown): T | null =>
  list.includes(v as T) ? (v as T) : null;

/**
 * The saved look lives in the Supabase user's metadata, so it follows the account across devices.
 * Looks saved before the catalog (cap / shirt / pants) map onto the new slots.
 */
export function readLook(user: User | null | undefined): CharacterLook {
  const raw = (user?.user_metadata?.character ?? {}) as Record<string, unknown>;
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    gender: pick(GENDERS, raw.gender, DEFAULT_LOOK.gender),
    body: pick(BODIES, raw.body, DEFAULT_LOOK.body),
    head: pickOrNull(HEAD, raw.head ?? raw.cap),
    audio: pickOrNull(AUDIO, raw.audio),
    top: pick(Object.keys(TOPS) as TopId[], raw.top ?? raw.shirt, DEFAULT_LOOK.top),
    bottom: pick(Object.keys(BOTTOMS) as BottomId[], raw.bottom ?? raw.pants, DEFAULT_LOOK.bottom),
    shoes: pickOrNull(Object.keys(SHOES) as ShoeId[], raw.shoes),
    socks: pickOrNull(Object.keys(SOCKS) as SockId[], raw.socks),
    gear: Array.isArray(raw.gear) ? GEAR.filter((g) => (raw.gear as unknown[]).includes(g)) : [],
  };
}

export async function saveLook(look: CharacterLook): Promise<void> {
  check(await supabase.auth.updateUser({ data: { character: { ...look, name: look.name.trim() } } }));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  f: string;
}

/** Sprite grid: 20 wide, rows −2…29 (caps poke above the head, soles sit on row 29). */
export const GRID = { w: 20, top: -2, h: 32 };

const camo = (x: number, y: number) => ['#5C6B3A', '#46522C', '#8A7F55', '#2F3A22'][(x * 7 + y * 13 + ((x * y) % 5)) % 4];
const tie = (x: number, y: number) => ['#F2A3C7', '#8EC9F2', '#F7E07A', '#B79AF2'][(x + y) % 4];

/** Draws the character as layered rectangles, back to front. */
export function buildSprite(look: Omit<CharacterLook, 'name'>): Rect[] {
  const { gender: g, body: b } = look;
  const B = FRAMES[g][b];
  const R: Rect[] = [];
  const add = (x: number, y: number, w: number, h: number, f: string) => {
    if (w > 0 && h > 0) R.push({ x, y, w, h, f });
  };
  const box = (a: Box, f: string) => add(a[0], a[1], a[2], a[3], f);
  const [hx, hw] = B.head;
  const rows: Record<number, [number, number]> = {};
  B.torso.forEach((t) => {
    for (let y = t[1]; y < t[1] + t[3]; y++) rows[y] = [t[0], t[2]];
  });
  const ys = Object.keys(rows)
    .map(Number)
    .sort((a, c) => a - c);
  const yB = ys[ys.length - 1];

  // Body.
  add(hx, 1, hw, 6, SK);
  B.neck.forEach((n) => add(n[0], n[1], n[2], n[3], n[4]));
  [...B.upper, ...B.mid, ...B.lower, ...B.hands, ...B.torso, ...B.legs].forEach((a) => box(a, SK));
  add(hx, 1, hw, 2, HAIR);
  if (g === 'F') {
    add(hx, 0, hw, 1, HAIR);
    add(hx - 1, 2, 1, 6, HAIR);
    add(hx + hw, 2, 1, 6, HAIR);
  }
  add(8, 4, 1, 1, INK);
  add(11, 4, 1, 1, INK);
  if (b === 'heavy') {
    add(hx, 6, 1, 1, '#D99A9A');
    add(hx + hw - 1, 6, 1, 1, '#D99A9A');
  }
  if (g === 'F') add(9, 6, 2, 1, '#C25B5B');

  // Socks.
  const SO: SockDef | null = look.socks ? SOCKS[look.socks] : null;
  if (SO) {
    B.legs.forEach((l) => {
      for (let y = SO.from; y <= 27; y++) add(l[0], y, l[2], 1, SO.stripe && y % 2 === 0 ? SO.stripe : SO.c);
    });
  }

  // Bottoms.
  const BT: BottomDef = BOTTOMS[look.bottom];
  const fillB = (x: number, y: number, w: number, c: string) => {
    if (BT.pattern) for (let i = 0; i < w; i++) add(x + i, y, 1, 1, camo(x + i, y));
    else add(x, y, w, 1, c);
  };
  let px = B.hips[0];
  let pw = B.hips[2];
  const py = B.hips[1];
  const ph = B.hips[3];
  if (BT.baggy) {
    px--;
    pw += 2;
  }
  if (BT.tights) B.legs.forEach((l) => add(l[0], 21, l[2], 7, BT.tights!));
  for (let y = py; y < py + ph; y++) fillB(px, y, pw, BT.legs === 0 && y === py + ph - 1 ? BT.s : BT.c);
  if (BT.stripe && !BT.legStripeOnly) {
    add(px, py, 1, ph, BT.stripe);
    add(px + pw - 1, py, 1, ph, BT.stripe);
  }
  if (BT.skirt) {
    const lx = B.legs[0][0] - 1;
    const rx = B.legs[1][0] + B.legs[1][2] + 1;
    for (let k = 0; k < BT.legs; k++) fillB(lx, 21 + k, rx - lx, k === BT.legs - 1 ? BT.s : BT.c);
  } else {
    B.legs.forEach((l, i) => {
      for (let k = 0; k < BT.legs; k++) {
        const y = 21 + k;
        let x = l[0];
        let w = l[2];
        if (BT.baggy) {
          if (i === 0) x--;
          w++;
        }
        if (BT.flare && y >= 26) {
          if (i === 0) x--;
          w++;
        }
        const hem = (BT.cuff && y === 27) || (BT.legs < 7 && k === BT.legs - 1);
        fillB(x, y, w, hem ? BT.s : BT.c);
        if (BT.stripe) add(i === 0 ? x : x + w - 1, y, 1, 1, BT.stripe);
      }
      if (BT.pockets) add(i === 0 ? l[0] : l[0] + l[2] - 1, 23, 1, 2, BT.s);
    });
  }

  // Shoes; without any, a dark line for the feet.
  const SH: ShoeDef | null = look.shoes ? SHOES[look.shoes] : null;
  if (SH?.socks) B.legs.forEach((l) => add(l[0], 26, l[2], 2, SH.socks!));
  B.legs.forEach((l, i) => {
    const x = i === 0 ? l[0] - 1 : l[0];
    const w = l[2] + 1;
    if (!SH) return add(x, 28, w, 1, INK);
    if (SH.high) add(l[0], 28 - SH.high, l[2], SH.high, SH.c);
    add(x, 28, w, 1, SH.c);
    if (SH.sole) add(x, 29, w, 1, SH.sole);
    if (SH.accent) add(i === 0 ? x : x + w - 1, 28, 1, 1, SH.accent);
  });

  // Top.
  const T: TopDef = TOPS[look.top];
  if (T.sleeves) {
    const parts =
      T.sleeves === 'upper'
        ? B.upper
        : T.sleeves === 'arm'
          ? [...B.upper, ...B.mid, ...B.lower.map((a): Box => [a[0], a[1], a[2], Math.min(2, a[3])])]
          : [...B.upper, ...B.mid, ...B.lower];
    parts.forEach((a) => box(a, T.sleeveC ?? T.c));
    if (T.rib && T.sleeves === 'full') B.lower.forEach((a) => add(a[0], a[1] + a[3] - 1, a[2], 1, T.s));
  }
  const drawn: Record<number, [number, number]> = {};
  const topRow = (x: number, y: number, w: number) => {
    drawn[y] = [x, w];
    if (T.pattern) for (let i = 0; i < w; i++) add(x + i, y, 1, 1, tie(x + i, y));
    else add(x, y, w, 1, T.c);
  };
  for (const y of ys) {
    if (T.rows && y > T.rows) continue;
    let [x, w] = rows[y];
    if (T.oversized) {
      x--;
      w += 2;
    }
    if (T.narrow && T.cut && y < 8 + T.cut) {
      if (y === 8) {
        add(x + T.narrow, 8, 1, 1, T.c);
        add(x + w - T.narrow - 1, 8, 1, 1, T.c);
        continue;
      }
      const nw = Math.max(2, w - 2 * T.narrow);
      x += Math.floor((w - nw) / 2);
      w = nw;
    }
    topRow(x, y, w);
  }
  if (T.longer) {
    const [bx, bw] = drawn[yB];
    for (let k = 1; k <= T.longer; k++) topRow(bx, yB + k, bw);
  }
  const last = Math.max(...Object.keys(drawn).map(Number));
  add(drawn[last][0], last, drawn[last][1], 1, T.s);
  const covers = (y: number, a: number, z: number) => !!drawn[y] && drawn[y][0] <= a && drawn[y][0] + drawn[y][1] > z;
  if (g === 'F' && !T.pattern && covers(11, 8, 11)) add(8, 11, 4, 1, T.s);
  if (g === 'M' && b === 'buff' && !T.narrow && covers(11, 6, 13)) add(6, 11, 8, 1, T.s);
  if (T.hood) add(hx, 7, hw, 1, T.s);
  if (T.zip) Object.keys(drawn).forEach((y) => add(9, Number(y), 2, 1, T.zip!));
  if (T.pocket && drawn[14] && drawn[15]) add(8, 14, 4, 2, T.s);
  if (T.strings) {
    add(8, 8, 1, 2, WH);
    add(11, 8, 1, 2, WH);
  }
  if (T.band && drawn[10]) add(drawn[10][0], 10, drawn[10][1], 1, T.band);
  if (T.bib) add(9, 11, 2, 2, WH);
  if (T.logo) {
    add(9, 10, 2, 2, T.logo);
    add(8, 11, 1, 1, T.logo);
    add(11, 11, 1, 1, T.logo);
  }

  // Training gear.
  const G = look.gear;
  if (G.includes('belt')) {
    const off = T.oversized ? 1 : 0;
    [yB - 1, yB].forEach((y) => add(rows[y][0] - off, y, rows[y][1] + 2 * off, 1, '#6B4226'));
    add(9, yB - 1, 2, 2, '#C9A227');
  }
  if (G.includes('towel')) {
    const u = B.upper[0];
    add(u[0], 8, u[2], 1, '#FFFFFF');
    add(rows[8][0], 8, 2, 4, '#FFFFFF');
    add(rows[8][0], 12, 2, 1, '#DADAD2');
  }
  if (G.includes('wraps')) B.hands.forEach((h) => add(h[0], h[1] - 1, h[2], 1, '#D64545'));
  if (G.includes('gloves')) B.hands.forEach((h) => add(h[0], h[1], h[2], 1, '#1A1A1A'));
  if (G.includes('knees'))
    B.legs.forEach((l) => {
      add(l[0], 23, l[2], 2, '#4A4A45');
      add(l[0], 23, l[2], 1, '#6E6E68');
    });

  // Headwear and audio.
  switch (look.head) {
    case 'cap':
      add(hx, 0, hw, 3, '#D64545');
      add(hx - 1, 3, hw + 2, 1, '#A83434');
      break;
    case 'beanie':
      add(hx, -1, hw, 3, '#2BA59B');
      add(hx, 2, hw, 1, '#1F7F77');
      add(9, -2, 2, 1, WH);
      break;
    case 'headband':
      add(hx, 2, hw, 1, '#FFFFFF');
      add(9, 2, 2, 1, '#9CC21F');
      add(hx + hw, 3, 1, 2, '#FFFFFF');
      break;
    case 'snapback':
      add(hx, 0, hw, 3, '#1A1A1A');
      add(hx - 1, 3, hw + 2, 1, '#1A1A1A');
      add(9, 1, 2, 1, '#C6F432');
      break;
    case 'backwards':
      add(hx, 0, hw, 3, WH);
      add(hx + 1, -1, hw - 2, 1, '#DADAD2');
      add(9, 2, 2, 1, '#A7A7A0');
      break;
    case 'bucket':
      add(hx, -1, hw, 3, '#6B7A3A');
      add(hx - 1, 2, hw + 2, 1, '#56632E');
      add(hx - 2, 3, 1, 1, '#56632E');
      add(hx + hw + 1, 3, 1, 1, '#56632E');
      break;
    case 'visor':
      add(hx, 2, hw, 1, WH);
      add(hx - 1, 3, hw + 2, 1, '#1E8C86');
      break;
    case 'bandana':
      add(hx, 0, hw, 3, '#D64545');
      add(hx + 1, 1, 1, 1, WH);
      add(hx + hw - 2, 0, 1, 1, WH);
      add(hx + 3, 2, 1, 1, WH);
      add(hx + hw, 2, 1, 2, '#D64545');
      break;
    case 'durag':
      add(hx, 0, hw, 3, '#24304F');
      add(hx, 2, hw, 1, '#1A2238');
      add(hx + hw, 3, 1, 4, '#24304F');
      break;
  }
  if (look.audio === 'earbuds') {
    add(hx - 1, 4, 1, 1, '#FFFFFF');
    add(hx + hw, 4, 1, 1, '#FFFFFF');
  }
  if (look.audio === 'headphones') {
    add(hx - 1, -1, hw + 2, 1, '#1A1A1A');
    add(hx - 1, 0, 1, 3, '#1A1A1A');
    add(hx + hw, 0, 1, 3, '#1A1A1A');
    add(hx - 2, 3, 2, 3, '#1A1A1A');
    add(hx + hw, 3, 2, 3, '#1A1A1A');
    add(hx - 2, 4, 1, 1, '#C6F432');
    add(hx + hw + 1, 4, 1, 1, '#C6F432');
  }
  return R;
}

/** Body measurements the pose animations need to move arms and legs. */
export function bodyFrame(look: Pick<CharacterLook, 'gender' | 'body'>): Frame {
  return FRAMES[look.gender][look.body];
}
