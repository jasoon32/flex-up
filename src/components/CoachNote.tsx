import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { colors, fonts, radius, space } from '@/theme';

export type CoachState = { kind: 'loading' } | { kind: 'text'; text: string } | { kind: 'error'; message: string };

/** A note from the AI coach: a thinking line while it writes, the note, or why it couldn't. */
export function CoachNote({
  state,
  dark,
  onRetry,
  compact,
}: {
  state: CoachState;
  /** On the dark finish screen. */
  dark?: boolean;
  onRetry?: () => void;
  /** Smaller, for History rows. */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const A = t.ai;
  const fg = dark ? colors.onInk : colors.text;
  const muted = dark ? colors.onInkMuted : colors.muted;
  return (
    <View
      style={[s.box, dark ? s.dark : s.light, compact && s.compact]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={state.kind === 'text' ? `${A.coach}: ${state.text}` : undefined}
    >
      <View style={s.head}>
        <View style={[s.badge, dark && { backgroundColor: colors.lime }]}>
          <Ionicons name="chatbubble-ellipses" size={compact ? 11 : 13} color={colors.ink} />
        </View>
        <Text style={[s.label, { color: dark ? colors.lime : colors.muted }]}>{A.coach.toUpperCase()}</Text>
      </View>
      {state.kind === 'loading' ? (
        <View style={s.row}>
          <ActivityIndicator size="small" color={muted} />
          <Text style={[s.text, { color: muted }]}>{A.thinking}</Text>
        </View>
      ) : state.kind === 'text' ? (
        <Text style={[s.text, compact && s.textSmall, { color: fg }]}>{state.text}</Text>
      ) : (
        <View style={s.row}>
          <Text style={[s.text, { color: muted, flex: 1 }]}>{state.message}</Text>
          {onRetry ? (
            <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
              <Text style={[s.retry, { color: dark ? colors.lime : colors.text }]}>{A.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderRadius: radius.md, padding: space.md, gap: 6 },
  dark: { backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine },
  light: { backgroundColor: colors.limeSoft },
  compact: { padding: space.sm, gap: 4, borderRadius: radius.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 1.1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 14, lineHeight: 20, fontFamily: fonts.medium },
  textSmall: { fontSize: 13, lineHeight: 18 },
  retry: { fontSize: 13, fontFamily: fonts.bold },
});
