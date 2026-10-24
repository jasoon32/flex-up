import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { formatRest, REST_MAX } from '@/lib/validation';
import { colors, fonts, radius } from '@/theme';

interface Rest {
  endsAt: number;
  total: number;
  /** Exercise the rest follows, e.g. "Lat Pulldown". */
  label: string;
}

interface RestTimer {
  /** Starts (or restarts) a rest of `seconds`. */
  start: (seconds: number, label: string) => void;
  stop: () => void;
}

const RestTimerContext = createContext<RestTimer>({ start: () => {}, stop: () => {} });

const TAB_ROUTES = ['/', '/plans', '/history', '/character', '/settings'];
/** A rest that ended this long ago (app was in the background) finishes silently. */
const STALE_MS = 5000;
const OVER_SHOWN_MS = 4000;

/**
 * One rest timer for the whole app, so it keeps counting when you leave the workout screen.
 * Alerts (vibration and a short sound) only happen while the app is open.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [rest, setRest] = useState<Rest | null>(null);
  const [over, setOver] = useState(false);

  const start = useCallback((seconds: number, label: string) => {
    setOver(false);
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds, label });
  }, []);
  const stop = useCallback(() => {
    setRest(null);
    setOver(false);
  }, []);

  const value = useMemo(() => ({ start, stop }), [start, stop]);

  return (
    <RestTimerContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {rest || over ? (
          <RestBar rest={rest} over={over} setRest={setRest} setOver={setOver} onDismiss={stop} />
        ) : null}
      </View>
    </RestTimerContext.Provider>
  );
}

export const useRestTimer = () => useContext(RestTimerContext);

function RestBar({
  rest,
  over,
  setRest,
  setOver,
  onDismiss,
}: {
  rest: Rest | null;
  over: boolean;
  setRest: (fn: (r: Rest | null) => Rest | null) => void;
  setOver: (v: boolean) => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const R = t.rest;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const player = useAudioPlayer(require('../../assets/rest-done.wav'));
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef<number | null>(null);

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const remainingMs = rest ? rest.endsAt - now : 0;

  useEffect(() => {
    if (!rest || remainingMs > 0 || alerted.current === rest.endsAt) return;
    alerted.current = rest.endsAt;
    setRest(() => null);
    if (-remainingMs > STALE_MS) return;
    setOver(true);
    Vibration.vibrate([0, 300, 150, 300]);
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is a bonus; the vibration and banner still signal the end.
    }
  }, [rest, remainingMs, player, setRest, setOver]);

  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => setOver(false), OVER_SHOWN_MS);
    return () => clearTimeout(id);
  }, [over, setOver]);

  const adjust = (delta: number) =>
    setRest((r) => {
      if (!r) return r;
      const left = Math.max(0, r.endsAt - Date.now()) / 1000;
      const next = Math.min(REST_MAX, Math.max(1, left + delta));
      return { ...r, endsAt: Date.now() + next * 1000, total: Math.max(r.total, Math.ceil(next)) };
    });

  const onTabs = TAB_ROUTES.includes(pathname);
  const bottom = insets.bottom + (onTabs ? 60 : 12);

  if (over || !rest) {
    return (
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLabel={R.over}
        style={[s.bar, s.barLime, { bottom }]}
      >
        <View style={s.overIcon}>
          <Ionicons name="checkmark" size={18} color={colors.lime} />
        </View>
        <Text style={[s.overText]}>{R.over}</Text>
      </Pressable>
    );
  }

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const ending = seconds <= 10;
  const pct = Math.min(100, Math.max(0, (remainingMs / 1000 / rest.total) * 100));
  const fg = ending ? colors.ink : colors.onInk;

  return (
    <View style={[s.bar, ending && s.barLime, { bottom }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.eyebrow, { color: ending ? colors.ink : colors.lime }]}>{R.title}</Text>
        <Text style={[s.time, { color: fg }]} accessibilityRole="timer">
          {formatRest(seconds)}
        </Text>
        <Text style={[s.label, { color: ending ? colors.ink : colors.onInkMuted }]} numberOfLines={1}>
          {R.after(rest.label)}
        </Text>
      </View>
      <Pill text={R.minus} label={R.minusLabel} onPress={() => adjust(-15)} ending={ending} />
      <Pill text={R.plus} label={R.plusLabel} onPress={() => adjust(15)} ending={ending} />
      <Pill text={R.skip} label={R.skipLabel} onPress={onDismiss} ending={ending} strong />
      <View style={[s.progress, { width: `${pct}%`, backgroundColor: ending ? colors.ink : colors.lime }]} />
    </View>
  );
}

function Pill({
  text,
  label,
  onPress,
  ending,
  strong,
}: {
  text: string;
  label: string;
  onPress: () => void;
  ending: boolean;
  strong?: boolean;
}) {
  const bg = strong ? (ending ? colors.ink : colors.lime) : ending ? 'rgba(17,17,17,0.12)' : colors.inkRaised;
  const fg = strong ? (ending ? colors.lime : colors.ink) : ending ? colors.ink : colors.onInk;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [s.pill, { backgroundColor: bg }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.pillText, { color: fg }]}>{text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  barLime: { backgroundColor: colors.lime },
  eyebrow: { fontSize: 11, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 1 },
  time: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  label: { fontSize: 12, fontFamily: fonts.medium },
  pill: { height: 40, minWidth: 48, paddingHorizontal: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontFamily: fonts.bold },
  progress: { position: 'absolute', left: 0, bottom: 0, height: 4 },
  overIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overText: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: colors.ink, marginLeft: 6 },
});
