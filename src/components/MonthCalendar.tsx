import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { locale, useI18n } from '@/i18n';
import { WEEK_ORDER } from '@/lib/days';
import { dayKey } from '@/data/progress';
import { colors, fonts } from '@/theme';

/** A month of days, Monday first; days with a finished workout are filled. Arrows move between months. */
export function MonthCalendar({ days, onPickDay }: { days: Set<string>; onPickDay?: (key: string) => void }) {
  const { t } = useI18n();
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const trained = cells.filter((d) => d && days.has(dayKey(d))).length;
  const isThisMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const move = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Pressable onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel={t.progress.prevMonth} hitSlop={8} style={styles.arrow}>
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.month}>{month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</Text>
          <Text style={styles.count}>{t.progress.daysTrained(trained)}</Text>
        </View>
        <Pressable
          onPress={() => move(1)}
          disabled={isThisMonth}
          accessibilityRole="button"
          accessibilityLabel={t.progress.nextMonth}
          hitSlop={8}
          style={[styles.arrow, isThisMonth && { opacity: 0.3 }]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEK_ORDER.map((d) => (
          <Text key={d} style={styles.dow}>
            {t.days.letter[d]}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={styles.cell} />;
            const key = dayKey(d);
            const done = days.has(key);
            const today = key === dayKey(now);
            return (
              <Pressable
                key={i}
                onPress={done && onPickDay ? () => onPickDay(key) : undefined}
                disabled={!done || !onPickDay}
                accessibilityLabel={`${d.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}${done ? `, ${t.days.status.completed}` : ''}`}
                style={styles.cell}
              >
                <View style={[styles.dot, done && styles.dotDone, today && !done && styles.dotToday]}>
                  <Text style={[styles.num, done && { color: colors.lime }]}>{d.getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  count: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11, color: colors.faint },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.ink },
  dotToday: { borderWidth: 1.5, borderColor: colors.ink },
  num: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
