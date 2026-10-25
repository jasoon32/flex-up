import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useFocusData } from '@/hooks/useAsync';
import { locale, useI18n } from '@/i18n';
import { loadProgress, type ExerciseHistory, type Progress } from '@/data/progress';
import { listBodyWeights } from '@/data/bodyweight';
import { trName } from '@/data/names';
import { readLook } from '@/lib/character';
import { MAX_LEVEL, unlocksAt } from '@/lib/levels';
import { MUSCLES, WEEKLY_SET_TARGET } from '@/lib/muscles';
import { formatKg, formatVolume, shortDate, signed } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { EmptyState, ErrorBanner, Eyebrow, Loading, styles } from '@/components/ui';
import { PixelCharacter } from '@/components/PixelCharacter';
import { MonthCalendar } from '@/components/MonthCalendar';
import { BodyWeightCard } from '@/components/BodyWeightCard';
import { FriendsCard } from '@/components/FriendsCard';
import { colors, fonts, radius, space } from '@/theme';

const SHOWN_EXERCISES = 6;

export default function ProgressTab() {
  const { t } = useI18n();
  const P = t.progress;
  const { session } = useAuth();
  const look = readLook(session?.user);
  const [allExercises, setAllExercises] = useState(false);
  const { data, error, loading, reload } = useFocusData(async () => {
    const [progress, weights] = await Promise.all([loadProgress(), listBodyWeights().catch(() => [])]);
    return { progress, weights };
  });

  if (!data && loading) return <Loading />;
  const p = data?.progress;
  const exercises = p ? (allExercises ? p.exercises : p.exercises.slice(0, SHOWN_EXERCISES)) : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: space.xl }]}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.muted} />}
      >
        <Text style={styles.title}>{P.title}</Text>
        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

        {p ? (
          <>
            <LevelCard progress={p} look={look} />

            {p.totals.workouts === 0 ? (
              <EmptyState title={P.emptyTitle} message={P.empty} />
            ) : (
              <>
                <MonthCard progress={p} />

                <View style={s.card}>
                  <Eyebrow>{P.calendar}</Eyebrow>
                  <MonthCalendar days={p.days} />
                  <View style={[styles.row, { gap: 10 }]}>
                    <Stat label={P.currentStreak} value={P.days(p.currentStreak)} />
                    <Stat label={P.bestStreak} value={P.days(p.longestStreak)} />
                  </View>
                </View>

                <WeeklyBars progress={p} />
                <MuscleBars progress={p} />

                <View style={{ gap: 10 }}>
                  <View style={{ gap: 2 }}>
                    <Eyebrow>{P.exercises}</Eyebrow>
                    <Text style={styles.small}>{P.exercisesHint}</Text>
                  </View>
                  <View style={s.list}>
                    {exercises.map((e, i) => (
                      <ExerciseRow key={e.name} exercise={e} first={i === 0} />
                    ))}
                  </View>
                  {p.exercises.length > SHOWN_EXERCISES ? (
                    <Pressable onPress={() => setAllExercises((v) => !v)} accessibilityRole="button" style={s.more}>
                      <Text style={s.moreText}>{allExercises ? P.showLess : P.showAll(p.exercises.length)}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            )}

            <BodyWeightCard weights={data!.weights} onChanged={reload} />
            <FriendsCard />
            <Badges progress={p} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LevelCard({ progress, look }: { progress: Progress; look: ReturnType<typeof readLook> }) {
  const { t } = useI18n();
  const P = t.progress;
  const { level, into, span } = progress.level;
  let next: { item: string; level: number } | null = null;
  for (let l = level + 1; l <= MAX_LEVEL && !next; l++) {
    const items = unlocksAt(l);
    if (items.length) next = { item: t.character.items[items[0]], level: l };
  }
  const pct = Math.min(1, into / span);
  return (
    <Pressable
      onPress={() => router.push('/character')}
      accessibilityRole="button"
      accessibilityLabel={`${P.level(level)}, ${P.xp(into.toLocaleString(locale()), span.toLocaleString(locale()))}`}
      style={({ pressed }) => [s.hero, pressed && { opacity: 0.85 }]}
    >
      <View style={s.heroArt}>
        <PixelCharacter pixel={3} look={look} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Eyebrow color={colors.lime}>{look.name.trim() || t.character.defaultName}</Eyebrow>
        <Text style={s.heroTitle}>{P.level(level)}</Text>
        <View style={s.xpTrack}>
          <View style={[s.xpFill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <Text style={s.heroText}>{P.xp(into.toLocaleString(locale()), span.toLocaleString(locale()))}</Text>
        <Text style={s.heroText}>{next ? P.nextUnlock(next.item, next.level) : P.allUnlocked}</Text>
      </View>
    </Pressable>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function MonthCard({ progress }: { progress: Progress }) {
  const { t } = useI18n();
  const P = t.progress;
  const m = progress.month;
  const l = progress.lastMonth;
  const delta = (now: number, before: number, fmt: (n: number) => string) => {
    const d = signed(now - before);
    return d ? P.vsLastMonth(now >= before ? `+${fmt(now - before)}` : `−${fmt(before - now)}`) : P.sameAsLastMonth;
  };
  const hours = (min: number) => P.hours((Math.round((min / 60) * 10) / 10).toLocaleString(locale()));
  return (
    <View style={s.card}>
      <Eyebrow>{P.thisMonth}</Eyebrow>
      <View style={s.grid}>
        <Stat label={P.workouts} value={String(m.workouts)} sub={delta(m.workouts, l.workouts, String)} />
        <Stat label={P.volume} value={formatVolume(m.volumeKg)} sub={delta(m.volumeKg, l.volumeKg, formatVolume)} />
        <Stat label={P.sets} value={String(m.sets)} sub={delta(m.sets, l.sets, String)} />
        <Stat label={P.time} value={hours(m.minutes)} sub={delta(m.minutes, l.minutes, hours)} />
      </View>
    </View>
  );
}

function WeeklyBars({ progress }: { progress: Progress }) {
  const { t } = useI18n();
  const P = t.progress;
  const max = Math.max(1, ...progress.weeks.map((w) => w.volumeKg));
  return (
    <View style={s.card}>
      <View style={{ gap: 2 }}>
        <Eyebrow>{P.weekly}</Eyebrow>
        <Text style={styles.small}>{P.weeklyHint}</Text>
      </View>
      <View style={s.bars}>
        {progress.weeks.map((w, i) => {
          const last = i === progress.weeks.length - 1;
          const kg = Math.round(w.volumeKg).toLocaleString(locale());
          return (
            <View
              key={w.start.getTime()}
              style={s.barCol}
              accessible
              accessibilityLabel={P.weekBar(shortDate(w.start), kg, w.workouts)}
            >
              <Text style={[s.barValue, !last && { opacity: 0 }]} numberOfLines={1}>
                {w.volumeKg ? formatVolume(w.volumeKg) : ''}
              </Text>
              <View style={s.barTrack}>
                <View
                  style={[
                    s.bar,
                    { height: `${Math.max(w.volumeKg ? 4 : 0, Math.round((w.volumeKg / max) * 100))}%` },
                    last && { backgroundColor: colors.lime, borderWidth: 1.5, borderColor: colors.ink },
                  ]}
                />
              </View>
              <Text style={s.barLabel} numberOfLines={1}>
                {w.start.getDate()}/{w.start.getMonth() + 1}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MuscleBars({ progress }: { progress: Progress }) {
  const { t } = useI18n();
  const P = t.progress;
  const top = Math.max(WEEKLY_SET_TARGET.max, ...MUSCLES.map((m) => progress.muscles[m]));
  return (
    <View style={s.card}>
      <View style={{ gap: 2 }}>
        <Eyebrow>{P.muscles}</Eyebrow>
        <Text style={styles.small}>{P.musclesHint}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {MUSCLES.map((m) => {
          const n = progress.muscles[m];
          const inRange = n >= WEEKLY_SET_TARGET.min && n <= WEEKLY_SET_TARGET.max;
          return (
            <View key={m} style={[styles.row, { gap: 10 }]} accessible accessibilityLabel={`${P.muscleNames[m]}: ${n}`}>
              <Text style={s.muscleName}>{P.muscleNames[m]}</Text>
              <View style={s.muscleTrack}>
                {/* The 10–20 band, so it's clear where each muscle should land. */}
                <View
                  style={[
                    s.band,
                    {
                      left: `${(WEEKLY_SET_TARGET.min / top) * 100}%`,
                      width: `${((WEEKLY_SET_TARGET.max - WEEKLY_SET_TARGET.min) / top) * 100}%`,
                    },
                  ]}
                />
                <View
                  style={[
                    s.muscleFill,
                    { width: `${(n / top) * 100}%` },
                    inRange && { backgroundColor: colors.lime, borderColor: colors.ink, borderWidth: 1 },
                  ]}
                />
              </View>
              <Text style={s.muscleCount}>{n}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ExerciseRow({ exercise, first }: { exercise: ExerciseHistory; first: boolean }) {
  const { t } = useI18n();
  const best =
    exercise.bestKg > 0 ? formatKg(exercise.bestKg, exercise.unit) : t.exercise.reps(exercise.bestReps);
  const values = exercise.entries.map((e) => e.e1rmKg ?? (e.topKg || e.topReps));
  const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/exercise/[name]', params: { name: exercise.name } })}
      accessibilityRole="button"
      style={({ pressed }) => [s.exRow, !first && s.exDivider, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={s.exName} numberOfLines={1}>
          {trName(exercise.name)}
        </Text>
        <Text style={styles.small} numberOfLines={1}>
          {t.progress.exerciseMeta(best, exercise.entries.length)}
        </Text>
      </View>
      {trend !== 0 ? (
        <Ionicons
          name={trend > 0 ? 'trending-up' : 'trending-down'}
          size={18}
          color={trend > 0 ? colors.ink : colors.faint}
        />
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function Badges({ progress }: { progress: Progress }) {
  const { t } = useI18n();
  const P = t.progress;
  const earned = progress.badges.filter((b) => b.earned).length;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.between}>
        <Eyebrow>{P.badges}</Eyebrow>
        <Text style={styles.small}>{P.badgesCount(earned, progress.badges.length)}</Text>
      </View>
      <View style={s.badges}>
        {progress.badges.map((b) => (
          <Pressable
            key={b.id}
            onPress={() =>
              Alert.alert(
                `${b.icon} ${P.badgeNames[b.id]}`,
                `${P.badgeHow[b.id]}\n${b.earned ? P.earned : P.notYet(Math.floor(b.progress * 100))}`,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`${P.badgeNames[b.id]}, ${b.earned ? P.earned : P.notYet(Math.floor(b.progress * 100))}`}
            style={[s.badge, b.earned && s.badgeOn]}
          >
            <Text style={[s.badgeIcon, !b.earned && { opacity: 0.25 }]}>{b.icon}</Text>
            <Text style={[s.badgeName, !b.earned && { color: colors.faint }]} numberOfLines={2}>
              {P.badgeNames[b.id]}
            </Text>
            {!b.earned && b.progress > 0 ? (
              <View style={s.badgeTrack}>
                <View style={[s.badgeFill, { width: `${Math.round(b.progress * 100)}%` }]} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    padding: space.xl,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  heroArt: {
    width: 84,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.onInk },
  heroText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.onInkMuted },
  xpTrack: { height: 10, borderRadius: 5, backgroundColor: colors.inkLine, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 5, backgroundColor: colors.lime },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    gap: 2,
  },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  statSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  bars: { flexDirection: 'row', gap: 6, height: 150, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barValue: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink, width: 60, textAlign: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: colors.ink },
  barLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.faint },
  muscleName: { width: 76, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  muscleTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.bg, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.limeSoft },
  muscleFill: { height: '100%', borderRadius: 7, backgroundColor: colors.faint },
  muscleCount: { width: 24, textAlign: 'right', fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  list: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
  },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  exDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  exName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  more: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    width: '31.5%',
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
  },
  badgeOn: { borderColor: colors.ink, borderWidth: 2, backgroundColor: colors.limeSoft },
  badgeIcon: { fontSize: 28 },
  badgeName: { fontFamily: fonts.semibold, fontSize: 12, textAlign: 'center', color: colors.ink },
  badgeTrack: { width: '80%', height: 4, borderRadius: 2, backgroundColor: colors.bg, overflow: 'hidden' },
  badgeFill: { height: '100%', backgroundColor: colors.faint },
});
