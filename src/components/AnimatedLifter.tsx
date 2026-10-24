import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { strings } from '@/i18n';
import type { CharacterLook } from '@/lib/character';
import { FRAME_COUNT, FRAME_MS, framesBounds, poseFrames, type Pose } from '@/lib/poses';

/** Ticks through the rep loop; `paused` holds the current frame. */
export function useRepFrame(paused = false) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    return () => clearInterval(id);
  }, [paused]);
  return frame;
}

/**
 * The user's lifter doing a rep loop of `pose`, scaled to fit `maxWidth` × `maxHeight` in whole pixels.
 * `frame` counts up forever; it's wrapped onto the loop here.
 */
function AnimatedLifterBase({
  look,
  pose,
  frame,
  heavy = false,
  maxWidth,
  maxHeight,
}: {
  look: CharacterLook;
  pose: Pose;
  frame: number;
  heavy?: boolean;
  maxWidth: number;
  maxHeight: number;
}) {
  const frames = useMemo(() => poseFrames(look, pose, heavy), [look, pose, heavy]);
  const box = useMemo(() => framesBounds(frames), [frames]);
  const pixel = Math.max(1, Math.floor(Math.min(maxWidth / box.w, maxHeight / box.h)));
  const rects = frames[frame % Math.min(frames.length, FRAME_COUNT)];
  const name = look.name.trim() || strings().character.defaultName;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={strings().share.poses[pose](name)}
      style={{ width: box.w * pixel, height: box.h * pixel }}
    >
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: (r.x - box.x) * pixel,
            top: (r.y - box.y) * pixel,
            width: r.w * pixel,
            height: r.h * pixel,
            backgroundColor: r.f,
          }}
        />
      ))}
    </View>
  );
}

export const AnimatedLifter = memo(AnimatedLifterBase);
