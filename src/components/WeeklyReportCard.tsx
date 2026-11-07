import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { dismissReport, getWeeklyReport, isReportDay, reportDismissed } from '@/data/coach';
import { aiErrorText, type WeeklyReport } from '@/lib/ai';
import { colors, fonts, radius, space } from '@/theme';

/** The coach's report card for the week, on Home every Sunday until it is dismissed. */
export function WeeklyReportCard() {
  const { t, lang } = useI18n();
  const A = t.ai;
  const [hidden, setHidden] = useState(() => !isReportDay() || reportDismissed());
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hidden) return;
    let active = true;
    getWeeklyReport()
      .then((r) => active && setReport(r))
      .catch((e) => active && setError(aiErrorText(e)));
    return () => {
      active = false;
    };
  }, [hidden, attempt, lang]);

  if (hidden) return null;

  const close = () => {
    dismissReport();
    setHidden(true);
  };

  return (
    <View style={s.card} accessibilityLiveRegion="polite">
      <View style={s.head}>
        <View style={s.badge}>
          <Ionicons name="ribbon" size={14} color={colors.ink} />
        </View>
        <Text style={s.eyebrow}>{A.reportEyebrow.toUpperCase()}</Text>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={A.dismiss}
          hitSlop={10}
          style={{ marginLeft: 'auto' }}
        >
          <Ionicons name="close" size={18} color={colors.onInkMuted} />
        </Pressable>
      </View>
      {report ? (
        <>
          <Text style={s.title}>{report.title}</Text>
          <View style={{ gap: 6 }}>
            {report.highlights.map((h, i) => (
              <View key={i} style={s.line}>
                <View style={s.bullet} />
                <Text style={s.text}>{h}</Text>
              </View>
            ))}
          </View>
          {report.focus ? (
            <View style={s.focus}>
              <Text style={s.focusLabel}>{A.focus}</Text>
              <Text style={s.focusText}>{report.focus}</Text>
            </View>
          ) : null}
        </>
      ) : error ? (
        <View style={s.line}>
          <Text style={[s.text, { flex: 1, color: colors.onInkMuted }]}>{error}</Text>
          <Pressable
            onPress={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={s.retry}>{A.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.line}>
          <ActivityIndicator size="small" color={colors.onInkMuted} />
          <Text style={[s.text, { color: colors.onInkMuted }]}>{A.reportLoading}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 1.1, color: colors.lime },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.onInk },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: { width: 6, height: 6, backgroundColor: colors.lime },
  text: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontFamily: fonts.medium, color: colors.onInk },
  focus: { backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.md, gap: 2 },
  focusLabel: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 0.8, color: colors.lime },
  focusText: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold, color: colors.onInk },
  retry: { fontSize: 13, fontFamily: fonts.bold, color: colors.lime },
});
