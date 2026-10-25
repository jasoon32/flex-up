import type { CharacterLook, ItemId } from './character';

/** Experience for the things a lifter does; everything is worked out from logged history. */
export const XP = { workout: 100, set: 10, record: 50 };

export const MAX_LEVEL = 99;

/** Total XP needed to reach `level`: 300 for level 2, 900 for 3, 1,800 for 4… (150·L·(L−1)). */
export const xpForLevel = (level: number) => 150 * level * (level - 1);

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP into the current level, and how much the level takes in total. */
  into: number;
  span: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const start = xpForLevel(level);
  const span = level >= MAX_LEVEL ? 1 : xpForLevel(level + 1) - start;
  return { level, xp, into: level >= MAX_LEVEL ? 1 : xp - start, span };
}

/**
 * The level each piece of gym-wear unlocks at. Basics for every lifter are there from the
 * start; the rest arrive a few at a time, so most levels bring something new to wear.
 */
export const UNLOCK_LEVEL: Record<ItemId, number> = {
  // Level 1: the basics.
  tank: 1,
  tee: 1,
  crop: 1,
  sportsbra: 1,
  shorts: 1,
  joggers: 1,
  leggings: 1,
  sweats: 1,
  whitetr: 1,
  crewW: 1,
  cap: 1,
  earbuds: 1,
  towel: 1,
  beanie: 2,
  crewB: 2,
  s5: 2,
  headband: 3,
  hoodie: 3,
  gloves: 3,
  graphic: 4,
  track: 4,
  runners: 4,
  snapback: 5,
  wraps: 5,
  bike: 5,
  raglan: 6,
  chucks: 6,
  s7: 6,
  headphones: 7,
  stringer: 7,
  knee: 7,
  backwards: 8,
  comptee: 8,
  cargo: 8,
  belt: 9,
  bball: 9,
  hightop: 9,
  muscle: 10,
  camo: 10,
  bucket: 10,
  ziphoodie: 12,
  cross: 12,
  flare: 12,
  visor: 14,
  complong: 14,
  wideleg: 14,
  crewneck: 16,
  minimal: 16,
  overtights: 16,
  bandana: 18,
  windbreaker: 18,
  skort: 18,
  singlet: 20,
  slides: 20,
  knees: 20,
  tiedye: 22,
  durag: 22,
  pump: 25,
  olylift: 25,
};

/** Items in the saved look stay wearable even if they'd be locked now (looks saved before levels). */
export function isUnlocked(id: ItemId, level: number, saved: CharacterLook): boolean {
  if (UNLOCK_LEVEL[id] <= level) return true;
  const worn: (ItemId | null)[] = [saved.head, saved.audio, saved.top, saved.bottom, saved.shoes, saved.socks, ...saved.gear];
  return worn.includes(id);
}

/** Gym-wear that unlocks on reaching `level` exactly (for the level-up screen). */
export const unlocksAt = (level: number): ItemId[] =>
  (Object.keys(UNLOCK_LEVEL) as ItemId[]).filter((id) => UNLOCK_LEVEL[id] === level);
