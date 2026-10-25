import { memo } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import type { PersonalRecord } from '@/data/achievements';
import { strings } from '@/i18n';
import { colors, fonts } from '@/theme';

/**
 * 16 × 16 pixel icons from the "Badges: pixel icons, no emoji" board, drawn as runs of
 * Views like the lifter. `#` takes the main colour, `+` the accent.
 */
const ICONS = {
  // "First record" on the board.
  trophy: [
    '',
    '...##########...',
    '##.####++####.##',
    '#..###++++###..#',
    '#..####++####..#',
    '##.##########.##',
    '...##########...',
    '....########....',
    '.....######.....',
    '......####......',
    '.......##.......',
    '.......##.......',
    '.....######.....',
    '....########....',
    '....########....',
    '',
  ],
  // "7-day streak" on the board.
  flame: [
    '.......#........',
    '......##........',
    '......###.......',
    '.....####...#...',
    '.....#####..##..',
    '....######.###..',
    '...###########..',
    '...####++#####..',
    '..####+++######.',
    '..####++++#####.',
    '..###++++++####.',
    '..###++++++####.',
    '...##+++++++##..',
    '...###+++++###..',
    '....#########...',
    '......#####.....',
  ],
  // "3-day streak" on the board.
  bolt: [
    '',
    '.........####...',
    '........####....',
    '.......####.....',
    '......####......',
    '.....####.......',
    '....##########..',
    '...##########...',
    '.......####.....',
    '......####......',
    '.....####.......',
    '....###.........',
    '...###..........',
    '..##............',
    '',
    '',
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

interface Run {
  x: number;
  y: number;
  w: number;
  accent: boolean;
}

const RUNS = Object.fromEntries(
  Object.entries(ICONS).map(([name, grid]) => {
    const runs: Run[] = [];
    grid.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === '#' || ch === '+') {
          let e = x;
          while (e < row.length && row[e] === ch) e++;
          runs.push({ x, y, w: e - x, accent: ch === '+' });
          x = e;
        } else x++;
      }
    });
    return [name, runs];
  }),
) as Record<PixelIconName, Run[]>;

/** One pixel icon about `size` points square, snapped to whole pixels so it stays crisp. */
function PixelIconBase({
  name,
  size = 16,
  color = colors.ink,
  accent = colors.lime,
  label,
}: {
  name: PixelIconName;
  size?: number;
  color?: string;
  accent?: string;
  label?: string;
}) {
  const px = Math.max(1, Math.round(size / 16));
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={{ width: 16 * px, height: 16 * px }}
    >
      {RUNS[name].map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: r.x * px,
            top: r.y * px,
            width: r.w * px,
            height: px,
            backgroundColor: r.accent ? accent : color,
          }}
        />
      ))}
    </View>
  );
}

export const PixelIcon = memo(PixelIconBase);

/** The icon for a record: a trophy when it was broken, a flame when it was matched. */
export const pbIcon = (pr: Pick<PersonalRecord, 'matched'>): PixelIconName => (pr.matched ? 'flame' : 'trophy');

/** Trophies for the records broken, then flames for the ones matched; long runs collapse to "trophy ×12". */
export function PbIcons({
  prs,
  size = 16,
  gap = 2,
  color,
  accent,
  countStyle,
}: {
  prs: PersonalRecord[];
  size?: number;
  gap?: number;
  color?: string;
  accent?: string;
  /** Style of the "×12" next to a collapsed run. */
  countStyle?: TextStyle;
}) {
  const broken = prs.filter((p) => !p.matched).length;
  const matched = prs.length - broken;
  if (prs.length === 0) return null;
  const C = strings().celebrate;
  const part = (n: number, name: PixelIconName) =>
    n === 0 ? null : n > 6 ? (
      <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
        <PixelIcon name={name} size={size} color={color} accent={accent} />
        <Text
          style={[{ fontFamily: fonts.bold, fontSize: size * 0.8, color: color ?? colors.ink }, countStyle]}
        >{`×${n}`}</Text>
      </View>
    ) : (
      Array.from({ length: n }, (_, i) => (
        <PixelIcon key={`${name}${i}`} name={name} size={size} color={color} accent={accent} />
      ))
    );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={[broken ? C.pbBroken(broken) : '', matched ? C.pbMatched(matched) : '']
        .filter(Boolean)
        .join(', ')}
      style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap }}
    >
      {part(broken, 'trophy')}
      {matched ? <View style={{ width: broken ? gap * 2 : 0 }} /> : null}
      {part(matched, 'flame')}
    </View>
  );
}
