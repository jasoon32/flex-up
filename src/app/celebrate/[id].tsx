import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPr, getWorkoutRecap, type Milestone, type WorkoutRecap } from '@/data/achievements';
import { locale, useI18n, type Strings } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import { readLook } from '@/lib/character';
import { isHeavy, poseFor } from '@/lib/poses';
import { useAuth } from '@/providers/AuthProvider';
import { Button, ErrorBanner, Loading } from '@/components/ui';
import { Confetti } from '@/components/Confetti';
import { pbIcon, PbIcons, PixelIcon } from '@/components/PixelBadge';
import { AnimatedLifter, useRepFrame } from '@/components/AnimatedLifter';
import { colors, fonts, radius, space } from '@/theme';
import { toKg } from '@/lib/units';
import { trName } from '@/data/names';

function headline(t: Strings, m: Milestone | null, recap: WorkoutRecap) {
  const C = t.celebrate;
  if (m?.kind === 'first') return C.first;
  if (m?.kind === 'count') return C.count(m.n);
  if (m?.kind === 'pr') return C.pr(trName(m.pr.exercise), formatPr(m.pr));
  if (m?.kind === 'streak') return C.streak(m.days);
  if (m?.kind === 'week') return C.week;
  const cheer = C.cheers[recap.workoutNumber % C.cheers.length];
  return { eyebrow: C.normal(recap.workoutNumber), title: cheer(trName(recap.session.plan_name, 'plan')) };
}

/** Shown right after Finish: confetti every time, full fireworks for milestones and records. */
export default function Celebrate() {
  const { t } = useI18n();
  const C = t.celebrate;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const look = readLook(session?.user);
  const [recap, setRecap] = useState<WorkoutRecap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRepFrame();

  useEffect(() => {
    let active = true;
    getWorkoutRecap(id)
      .then((r) => {
        if (!active) return;
        setRecap(r);
        const big = !!r.milestone || r.prs.some((p) => !p.matched);
        Vibration.vibrate(big ? [0, 60, 80, 60, 80, 240] : 50);
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!recap) {
    return error ? (
      <SafeAreaView style={[s.screen, { padding: space.xl, gap: space.md }]}>
        <ErrorBanner message={`${C.couldntLoad}. ${error}`} />
        <Button title={C.done} variant="lime" onPress={close} />
      </SafeAreaView>
    ) : (
      <Loading dark />
    );
  }

  const big = !!recap.milestone || recap.prs.some((p) => !p.matched);
  const head = headline(t, recap.milestone, recap);
  const pose = poseFor(recap.session.plan_name, recap.done.map((g) => g.name));
  const partial = recap.completedSets < recap.totalSets;

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.content}>
          <View style={{ alignItems: 'center', gap: 6 }} accessibilityRole="header">
            <Text style={s.eyebrow}>{head.eyebrow.toLocaleUpperCase(locale())}</Text>
            <Text style={[s.title, big && s.titleBig]}>{head.title}</Text>
          </View>

          <View style={[s.stage, big && s.stageBig]}>
            <AnimatedLifter
              look={look}
              pose={pose}
              heavy={isHeavy(recap.done.flatMap((g) => g.sets.map((x) => toKg(x.weight ?? 0, x.weight_unit))))}
              frame={frame}
              maxWidth={big ? 200 : 172}
              maxHeight={big ? 270 : 240}
            />
          </View>

          <View style={s.stats}>
            <Stat value={t.units.minutesShort(recap.minutes)} label={C.time} />
            <Stat value={`${recap.completedSets}`} label={C.sets(recap.completedSets)} />
            <Stat
              value={`${recap.streakDays}`}
              label={C.streakLabel}
              icon={<PixelIcon name="bolt" size={22} color={colors.lime} accent={colors.lime} />}
            />
          </View>

          {recap.prs.length > 0 ? (
            <View style={s.prs}>
              <View style={s.pbRow}>
                <PbIcons prs={recap.prs} size={32} gap={4} color={colors.onInk} accent={colors.lime} />
              </View>
              {recap.prs.map((pr) => (
                <View key={pr.exercise} style={s.prRow}>
                  <PixelIcon name={pbIcon(pr)} size={16} color={colors.onInk} accent={colors.lime} />
                  <Text style={s.prName} numberOfLines={1}>
                    {trName(pr.exercise)}
                  </Text>
                  <Text style={[s.prValue, pr.matched && { color: '#F07D2C' }]}>
                    {pr.matched ? C.prMatched(formatPr(pr)) : C.prLine(formatPr(pr), formatPr({ ...pr, value: pr.previous }))}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {partial ? <Text style={s.note}>{C.partial(recap.completedSets, recap.totalSets)}</Text> : null}

          <View style={s.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {recap.week.map((d) => (
              <View key={d.day} style={{ alignItems: 'center', gap: 4 }}>
                <Text style={s.weekDay}>{t.days.min[d.day]}</Text>
                <View style={[s.dot, d.done ? s.dotDone : d.planned ? s.dotPlanned : s.dotRest]}>
                  {d.done ? <Ionicons name="checkmark" size={12} color={colors.ink} /> : null}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={s.actions}>
          <Button
            title={C.share}
            variant="lime"
            icon={<Ionicons name="share-outline" size={18} color={colors.ink} />}
            onPress={() => router.replace(`/share/${id}`)}
          />
          <Pressable onPress={close} accessibilityRole="button" style={s.done}>
            <Text style={s.doneText}>{C.done}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      {/* On top of everything, but taps pass through. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Confetti big={big} />
      </View>
    </View>
  );
}

function Stat({ value, label, highlight, icon }: { value: string; label: string; highlight?: boolean; icon?: ReactNode }) {
  return (
    <View style={s.stat}>
      <View style={s.statTop}>
        {icon}
        <Text style={[s.statValue, highlight && { color: colors.lime }]}>{value}</Text>
      </View>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.xl, paddingTop: space.xxl * 2, gap: space.xl, alignItems: 'stretch' },
  eyebrow: { fontSize: 12, fontFamily: fonts.bold, color: colors.lime, letterSpacing: 1.2, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.onInk, textAlign: 'center' },
  titleBig: { fontSize: 34, lineHeight: 38 },
  stage: {
    alignSelf: 'center',
    width: 200,
    height: 270,
    borderRadius: radius.xl,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBig: { width: 230, height: 300, borderWidth: 2, borderColor: colors.lime },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.md, alignItems: 'center', gap: 2 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.onInk },
  statLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.onInkMuted },
  prs: { backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.md, gap: 10 },
  pbRow: { alignItems: 'center' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prName: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.onInk },
  prValue: { fontSize: 13, fontFamily: fonts.medium, color: colors.lime },
  note: { fontSize: 14, fontFamily: fonts.medium, color: colors.onInkMuted, textAlign: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm },
  weekDay: { fontSize: 11, fontFamily: fonts.semibold, color: colors.onInkMuted },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.lime },
  dotPlanned: { borderWidth: 1.5, borderColor: colors.onInkMuted },
  dotRest: { borderWidth: 1.5, borderColor: colors.inkLine, borderStyle: 'dashed' },
  actions: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 4 },
  done: { height: 48, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.onInkMuted },
});
