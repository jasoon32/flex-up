import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { strings } from '@/i18n';
import { DEFAULT_LOOK, GRID, buildSprite, type CharacterLook } from '@/lib/character';

/** The user's pixel-art lifter (20×32 grid), drawn from the Wardrobe and Gym-wear catalog designs. */
function PixelCharacterBase({
  pixel = 5,
  look = DEFAULT_LOOK,
  label,
}: {
  pixel?: number;
  look?: CharacterLook;
  /** Overrides the spoken description, e.g. for catalog cards. */
  label?: string;
}) {
  const rects = useMemo(() => buildSprite(look), [look]);
  const t = strings().character;
  const outfit = [
    t.bodies[look.body],
    look.head && t.items[look.head],
    look.audio && t.items[look.audio],
    t.items[look.top],
    t.items[look.bottom],
    look.shoes && t.items[look.shoes],
    look.socks && t.items[look.socks],
    ...look.gear.map((g) => t.items[g]),
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label ?? `${look.name.trim() || t.defaultName}: ${outfit}`}
      style={{ width: GRID.w * pixel, height: GRID.h * pixel }}
    >
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: r.x * pixel,
            top: (r.y - GRID.top) * pixel,
            width: r.w * pixel,
            height: r.h * pixel,
            backgroundColor: r.f,
          }}
        />
      ))}
    </View>
  );
}

export const PixelCharacter = memo(PixelCharacterBase);
