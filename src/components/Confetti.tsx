import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions } from 'react-native';

const COLORS = ['#C6F432', '#F07D2C', '#2BA59B', '#F27BAA', '#F4F4F0', '#2F5BFF'];

interface Piece {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  fall: Animated.Value;
}

function makePieces(count: number, width: number, waves: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    size: 6 + Math.round(Math.random() * 6),
    color: COLORS[i % COLORS.length],
    // Big celebrations come in a few waves, like fireworks going off one after another.
    delay: Math.floor(i / (count / waves)) * 900 + Math.random() * 500,
    duration: 2200 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 120,
    spin: (Math.random() - 0.5) * 4,
    fall: new Animated.Value(0),
  }));
}

/** Square pixel confetti falling over the whole screen; `big` adds more pieces in three waves. */
export function Confetti({ big }: { big: boolean }) {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() => makePieces(big ? 90 : 40, width, big ? 3 : 1));

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.timing(p.fall, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [pieces]);

  return (
    <>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            s.piece,
            {
              left: p.x,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              transform: [
                { translateY: p.fall.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] }) },
                { translateX: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                {
                  rotate: p.fall.interpolate({ inputRange: [0, 1], outputRange: ['0rad', `${p.spin * Math.PI}rad`] }),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

const s = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
});
