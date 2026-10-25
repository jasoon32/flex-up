import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { locale } from '@/i18n';
import { colors, fonts } from '@/theme';

export interface Point {
  /** Time in ms. */
  t: number;
  v: number;
}

const PAD = { left: 8, right: 8, top: 14, bottom: 22 };

const shortDate = (t: number) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

/**
 * A simple progress line: oldest on the left, newest on the right, the best point marked.
 * Tap anywhere to read the nearest point's value and date.
 */
export function LineChart({
  points,
  format,
  height = 170,
  label,
}: {
  points: Point[];
  format: (v: number) => string;
  height?: number;
  /** Read out by screen readers in place of the drawing. */
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  if (points.length === 0) return null;

  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const spread = hi - lo || Math.max(1, hi * 0.1);
  const min = lo - spread * 0.15;
  const max = hi + spread * 0.15;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const w = Math.max(1, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  // One point, or several on the same day, sit in the middle instead of on the edge.
  const x = (t: number) => PAD.left + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * h;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)},${PAD.top + h} L${x(t0).toFixed(1)},${PAD.top + h} Z`;
  const bestIndex = vs.lastIndexOf(hi);
  const shown = picked ?? points.length - 1;
  const p = points[shown];

  const pick = (px: number) => {
    let best = 0;
    points.forEach((pt, i) => {
      if (Math.abs(x(pt.t) - px) < Math.abs(x(points[best].t) - px)) best = i;
    });
    setPicked(best);
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.readout}>
        <Text style={styles.value}>{format(p.v)}</Text>
        <Text style={styles.date}>{shortDate(p.t)}</Text>
      </View>
      <Pressable
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => pick(e.nativeEvent.locationX)}
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={PAD.left}
                x2={PAD.left + w}
                y1={PAD.top + f * h}
                y2={PAD.top + f * h}
                stroke={colors.divider}
                strokeWidth={1}
              />
            ))}
            <Path d={area} fill={colors.limeSoft} />
            <Path d={line} stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((pt, i) => (
              <Circle
                key={i}
                cx={x(pt.t)}
                cy={y(pt.v)}
                r={i === shown ? 6 : i === bestIndex ? 5 : 3}
                fill={i === bestIndex ? colors.lime : colors.ink}
                stroke={colors.ink}
                strokeWidth={i === bestIndex || i === shown ? 2 : 0}
              />
            ))}
          </Svg>
        ) : null}
        <View style={styles.axis} pointerEvents="none">
          <Text style={styles.axisText}>{shortDate(t0)}</Text>
          {t1 !== t0 ? <Text style={styles.axisText}>{shortDate(t1)}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  value: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  date: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  axis: {
    position: 'absolute',
    left: PAD.left,
    right: PAD.right,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisText: { fontFamily: fonts.medium, fontSize: 11, color: colors.faint },
});
