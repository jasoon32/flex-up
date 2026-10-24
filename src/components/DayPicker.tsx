import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { WEEK_ORDER } from '@/lib/days';
import { useI18n } from '@/i18n';
import type { DayOfWeek } from '@/lib/types';

export function DayPicker({ value, onChange }: { value: DayOfWeek[]; onChange: (days: DayOfWeek[]) => void }) {
  const { t } = useI18n();
  const toggle = (d: DayOfWeek) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));

  return (
    <View style={s.row}>
      {WEEK_ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <Pressable
            key={d}
            onPress={() => toggle(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.days.long[d]}
            style={[s.day, on && s.dayOn]}
          >
            <Text style={[s.text, on && s.textOn]}>{t.days.min[d]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Read-only M T W T F S S strip used on plan cards. */
export function DayStrip({ days }: { days: DayOfWeek[] }) {
  const { t } = useI18n();
  return (
    <View style={s.stripRow}>
      {WEEK_ORDER.map((d) => {
        const on = days.includes(d);
        return (
          <View key={d} style={[s.strip, on && s.stripOn]} accessibilityLabel={t.days.long[d]}>
            <Text style={[s.stripText, on && s.stripTextOn]}>{t.days.letter[d]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.lime, borderColor: colors.ink, borderWidth: 2 },
  text: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 },
  textOn: { color: colors.ink },
  stripRow: { flexDirection: 'row', gap: 4 },
  strip: {
    flex: 1,
    height: 28,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripOn: { backgroundColor: colors.lime },
  stripText: { fontSize: 12, fontFamily: fonts.medium, color: '#6B6B66' },
  stripTextOn: { fontFamily: fonts.bold, color: colors.ink },
});
