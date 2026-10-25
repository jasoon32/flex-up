import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTarget, listPlans } from '@/data/plans';
import { deleteSession, getActiveSession, listSessionsSince, startSession } from '@/data/sessions';
import { useFocusData } from '@/hooks/useAsync';
import { locale, useI18n } from '@/i18n';
import { WEEK_ORDER, dateThisWeek, formatLongDate, isSameDay, startOfToday, startOfWeek, today } from '@/lib/days';
import { errorMessage } from '@/lib/errors';
import { readLook } from '@/lib/character';
import { loadLevel } from '@/data/progress';
import type { LevelInfo } from '@/lib/levels';
import { useAuth } from '@/providers/AuthProvider';
import { Badge, Button, Card, ErrorBanner, Eyebrow, Loading, ProTag, styles } from '@/components/ui';
import { PixelCharacter } from '@/components/PixelCharacter';
import { colors, fonts, radius, space } from '@/theme';
import type { DayOfWeek, PlanWithExercises, WorkoutSession } from '@/lib/types';
import { trName } from '@/data/names';
import { checkUnfinished } from '@/lib/unfinished';
import { openQuickWorkout } from '@/lib/quickWorkout';

interface HomeData {
  plans: PlanWithExercises[];
  week: WorkoutSession[];
  active: WorkoutSession | null;
  level: LevelInfo | null;
}

export default function Home() {
  const { t } = useI18n();
  const { session } = useAuth();
  const look = readLook(session?.user);
  const [starting, setStarting] = useState<string | null>(null);
  const [selected, setSelected] = useState<DayOfWeek>(today);
  const { data, error, loading, reload } = useFocusData<HomeData>(async () => {
    const [plans, week, active, level] = await Promise.all([
      listPlans(),
      listSessionsSince(startOfWeek()),
      getActiveSession(),
      loadLevel().catch(() => null),
    ]);
    return { plans, week, active, level };
  });

  const dow = today();
  // Any day of this week can be viewed, but only today's workout can be started.
  const isToday = selected === dow;
  const selectedDate = dateThisWeek(selected);
  const isPast = selectedDate < startOfToday();
  const dayName = t.days.long[selected];
  const scheduled = data?.plans.filter((p) => p.days.includes(selected)) ?? [];
  const daySessions = data?.week.filter((s) => isSameDay(new Date(s.started_at), selectedDate)) ?? [];
  /** Finished workouts that day that aren't one of the scheduled plans (e.g. Push on a rest day). */
  const otherDone = daySessions.filter((x) => x.completed_at && !scheduled.some((p) => p.id === x.plan_id));
  const activeElsewhere = data?.active && !(isToday && scheduled.some((p) => p.id === data.active!.plan_id));

  const start = async (plan: PlanWithExercises) => {
    const other = await checkUnfinished(plan.name);
    if (other.action === 'cancel') return;
    if (other.action === 'resume') return router.push(`/workout/${other.id}`);
    setStarting(plan.id);
    try {
      const id = await startSession(plan.id);
      router.push(`/workout/${id}`);
    } catch (e) {
      Alert.alert(t.home.couldntStart, errorMessage(e));
    } finally {
      setStarting(null);
    }
  };

  const discard = (session: WorkoutSession) =>
    Alert.alert(t.home.discardQ, t.home.discardMsg(trName(session.plan_name, 'plan')), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.home.discard,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSession(session.id);
            reload();
          } catch (e) {
            Alert.alert(t.workout.couldntDelete, errorMessage(e));
          }
        },
      },
    ]);

  if (!data && loading) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: space.xl }]}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.muted} />}
      >
        <View style={styles.between}>
          <View style={{ gap: 2 }}>
            <Text style={s.date}>{formatLongDate(new Date())}</Text>
            <View style={[styles.row, { gap: 8 }]}>
              <Text style={s.brand}>Flex Up</Text>
              <ProTag />
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t.home.account}
            style={s.avatar}
          >
            <Ionicons name="person-outline" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

        <Pressable
          onPress={() => router.push('/character')}
          accessibilityRole="button"
          style={({ pressed }) => [s.hero, pressed && { opacity: 0.85 }]}
        >
          <View style={s.heroArt}>
            <PixelCharacter pixel={4} look={look} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Eyebrow color={colors.lime}>{t.home.yourLifter}</Eyebrow>
            <Text style={s.heroTitle}>{look.name.trim() || t.character.defaultName}</Text>
            {data?.level ? (
              <View style={{ gap: 6 }}>
                <Text style={s.heroLevel}>
                  {t.progress.level(data.level.level)} ·{' '}
                  {t.progress.xp(data.level.into.toLocaleString(locale()), data.level.span.toLocaleString(locale()))}
                </Text>
                <View style={s.xpTrack}>
                  <View style={[s.xpFill, { width: `${Math.round((data.level.into / data.level.span) * 100)}%` }]} />
                </View>
              </View>
            ) : null}
            <Text style={s.heroText}>{t.home.tapToCustomise}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onInkMuted} />
        </Pressable>

        {/* Nothing loaded yet (e.g. no signal): show only the error above, not an empty week
            and a "No plans yet" card that would tempt you to recreate your plans. */}
        {data ? (
          <>
            <View style={{ gap: space.sm }}>
              <WeekStrip plans={data?.plans ?? []} week={data?.week ?? []} selected={selected} onSelect={setSelected} />
              {!isToday ? (
                <Button title={t.home.backToToday} variant="ghost" small onPress={() => setSelected(dow)} />
              ) : null}
            </View>

            {activeElsewhere ? (
              <Card style={{ gap: space.md }}>
                <View style={styles.between}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Eyebrow>{t.home.unfinishedWorkout}</Eyebrow>
                    <Text style={s.cardTitle}>{trName(data!.active!.plan_name, 'plan')}</Text>
                  </View>
                  <Badge label={t.badge.inProgress} tone="progress" />
                </View>
                <View style={styles.row}>
                  <Button
                    title={t.home.discard}
                    variant="secondary"
                    onPress={() => discard(data!.active!)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={t.home.resumeWorkout}
                    onPress={() => router.push(`/workout/${data!.active!.id}`)}
                    style={{ flex: 2 }}
                  />
                </View>
              </Card>
            ) : null}

            {otherDone.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Eyebrow>{isToday ? t.home.doneToday : t.home.doneOn(dayName)}</Eyebrow>
                {otherDone.map((x) => (
                  <View key={x.id} style={[styles.between, { gap: space.md }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.cardTitle}>{trName(x.plan_name, 'plan')}</Text>
                      <Badge label={t.badge.completed} tone="done" />
                    </View>
                    <Button
                      title={t.home.viewWorkout}
                      variant="secondary"
                      small
                      onPress={() => router.push(`/workout/${x.id}`)}
                    />
                  </View>
                ))}
              </Card>
            ) : null}

            {scheduled.length === 0 ? (
              <Card style={{ gap: space.md }}>
                <Eyebrow>{isToday ? t.home.todaysWorkout : t.home.dayWorkout(dayName)}</Eyebrow>
                <Text style={s.cardTitle}>{data?.plans.length ? t.home.restDay : t.home.noPlansYet}</Text>
                <Text style={styles.muted}>
                  {!data?.plans.length ? t.home.noPlansText : isToday ? t.home.restDayText : t.home.restDayOn(dayName)}
                </Text>
                <Button
                  title={data?.plans.length ? t.home.browsePlans : t.home.createPlan}
                  variant="secondary"
                  onPress={() => router.push(data?.plans.length ? '/plans' : '/plan/new')}
                />
                {isToday ? (
                  <Button
                    title={t.quick.start}
                    variant="white"
                    icon={<Ionicons name="flash-outline" size={18} color={colors.ink} />}
                    onPress={openQuickWorkout}
                  />
                ) : null}
                {!data?.plans.length ? (
                  <Button title={t.programs.browse} variant="ghost" onPress={() => router.push('/programs')} />
                ) : null}
              </Card>
            ) : (
              scheduled.map((plan) => {
                const sessions = daySessions.filter((x) => x.plan_id === plan.id);
                const done = sessions.find((x) => x.completed_at);
                const inProgress = sessions.find((x) => !x.completed_at);
                return (
                  <Card key={plan.id}>
                    <View style={[styles.between, { alignItems: 'flex-start' }]}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Eyebrow>{isToday ? t.home.todaysWorkout : t.home.dayWorkout(dayName)}</Eyebrow>
                        <Text style={s.cardTitle}>{trName(plan.name, 'plan')}</Text>
                        {done ? <Badge label={t.badge.completed} tone="done" /> : null}
                      </View>
                      <Pressable
                        onPress={() => router.push(`/plan/${plan.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={t.home.editPlan}
                        style={s.iconButton}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.ink} />
                      </Pressable>
                    </View>

                    {plan.exercises.length === 0 ? (
                      <Text style={styles.muted}>{t.home.noExercisesInPlan}</Text>
                    ) : (
                      <View>
                        {plan.exercises.map((ex, i) => (
                          <View key={ex.id} style={[s.exRow, i < plan.exercises.length - 1 && s.exDivider]}>
                            <Text style={[styles.textMedium, { flex: 1 }]}>{trName(ex.name)}</Text>
                            <Text style={[styles.text, { color: colors.muted }]}>{formatTarget(ex)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {plan.exercises.length === 0 ? (
                      <Button title={t.home.addExercises} onPress={() => router.push(`/plan/${plan.id}`)} />
                    ) : done ? (
                      <Button
                        title={t.home.viewWorkout}
                        variant="secondary"
                        onPress={() => router.push(`/workout/${done.id}`)}
                      />
                    ) : inProgress ? (
                      <Button title={t.home.resumeWorkout} onPress={() => router.push(`/workout/${inProgress.id}`)} />
                    ) : !isToday ? (
                      <View style={s.locked}>
                        <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
                        <Text style={[styles.small, { flex: 1 }]}>
                          {isPast ? t.home.dayPassed : t.home.startsOn(dayName)}
                        </Text>
                      </View>
                    ) : (
                      <Button
                        title={t.home.startWorkout}
                        icon={<Ionicons name="play" size={18} color={colors.lime} />}
                        onPress={() => start(plan)}
                        loading={starting === plan.id}
                      />
                    )}
                  </Card>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Mon–Sun: ✓ done, filled dot today, solid ring = planned, dashed ring = nothing planned.
 * Tapping a day shows that day's workout below.
 */
function WeekStrip({
  plans,
  week,
  selected,
  onSelect,
}: {
  plans: PlanWithExercises[];
  week: WorkoutSession[];
  selected: DayOfWeek;
  onSelect: (d: DayOfWeek) => void;
}) {
  const { t } = useI18n();
  const monday = startOfWeek();
  const dow = today();
  return (
    <View style={s.week}>
      {WEEK_ORDER.map((d, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const done = week.some((x) => x.completed_at && isSameDay(new Date(x.started_at), date));
        const isToday = d === dow;
        const isSelected = d === selected;
        const planned = plans.some((p) => p.days.includes(d));
        const status = done ? 'completed' : isToday ? 'today' : planned ? 'planned' : 'rest';
        const label = t.days.short[d];
        return (
          <Pressable
            key={d}
            onPress={() => onSelect(d)}
            style={[s.day, isToday && s.dayToday, isSelected && s.daySelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${t.days.long[d]}, ${t.days.status[status]}`}
          >
            <Text style={[s.dayText, (isToday || isSelected) && { color: colors.ink, fontFamily: fonts.bold }]}>
              {t.days.upper ? label.toUpperCase() : label}
            </Text>
            {done ? (
              <View style={[s.dot, { backgroundColor: colors.ink }]}>
                <Ionicons name="checkmark" size={14} color={colors.lime} />
              </View>
            ) : isToday ? (
              <View style={[s.dot, { backgroundColor: colors.ink }]} />
            ) : (
              <View style={[s.dot, planned ? s.dotPlanned : s.dotRest]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  date: { fontSize: 13, color: colors.muted, fontFamily: fonts.medium },
  brand: { fontSize: 26, fontFamily: fonts.display, color: colors.ink, letterSpacing: -0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    padding: space.xl,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  heroArt: {
    width: 112,
    height: 132,
    borderRadius: radius.md,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, color: colors.onInk },
  heroText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.onInkMuted },
  heroLevel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onInk },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: colors.inkLine, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  week: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  dayToday: { backgroundColor: colors.lime },
  daySelected: { borderWidth: 2, borderColor: colors.ink, paddingVertical: 6 },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  dayText: { fontSize: 11, color: colors.muted, fontFamily: fonts.semibold },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotPlanned: { borderWidth: 1.5, borderColor: colors.ink },
  dotRest: { borderWidth: 1.5, borderColor: '#B5B5AE', borderStyle: 'dashed' },
  cardTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.3 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: space.sm },
  exDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
});
