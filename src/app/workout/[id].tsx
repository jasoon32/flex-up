import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addSessionExercise,
  addSet,
  deleteSession,
  deleteSet,
  finishSession,
  formatSet,
  getLastSets,
  getSession,
  groupSets,
  reopenSession,
  setExerciseUnit,
  syncSessionWithPlan,
  updateSet,
} from '@/data/sessions';
import { formatTarget, getPlan } from '@/data/plans';
import { comparePb, getBestsBefore, PB_BROKEN, PB_MATCHED, type Best } from '@/data/achievements';
import { locale, useI18n } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import { validateName } from '@/lib/validation';
import { formatDuration, formatTime } from '@/lib/days';
import { usePrefs } from '@/lib/prefs';
import { nextUnit, setVolumeKg } from '@/lib/units';
import { useRestTimer } from '@/providers/RestTimerProvider';
import { Button, ErrorBanner, Loading, styles } from '@/components/ui';
import { SetHeader, SetRow } from '@/components/SetRow';
import { ExerciseNameInput } from '@/components/ExerciseNameInput';
import { colors, fonts, radius, space, WEIGHT_UNIT } from '@/theme';
import type { ExerciseGroup, SessionSet, SessionWithSets, SetPatch } from '@/lib/types';
import { trName } from '@/data/names';

interface Context {
  /** Last session's completed sets per exercise name. */
  last: Map<string, SessionSet[]>;
  /** Plan targets per exercise name, e.g. "4 × 6". */
  targets: Map<string, string>;
  /** Plan rest times in seconds per exercise name; missing or null uses the default. */
  rests: Map<string, number | null>;
  /** Bests from earlier workouts, for 🏆 / 🔥 as sets are ticked. */
  bests: Map<string, Best>;
}

async function loadContext(session: SessionWithSets): Promise<Context> {
  const names = [...new Set(session.sets.map((s) => s.exercise_name))];
  const [last, plan, bests] = await Promise.all([
    getLastSets(names, session.started_at).catch(() => new Map<string, SessionSet[]>()),
    session.plan_id ? getPlan(session.plan_id).catch(() => null) : Promise.resolve(null),
    getBestsBefore(names, session.started_at).catch(() => new Map<string, Best>()),
  ]);
  const exercises = plan?.exercises ?? [];
  const targets = new Map(exercises.map((e) => [e.name, formatTarget(e)]));
  const rests = new Map(exercises.map((e) => [e.name, e.rest_seconds]));
  return { last, targets, rests, bests };
}

/** Loads a session; an unfinished one first picks up any edits made to its plan since it started. */
async function getSyncedSession(id: string): Promise<SessionWithSets> {
  const s = await getSession(id);
  const changed = await syncSessionWithPlan(s).catch(() => false);
  return changed ? getSession(id) : s;
}

export default function WorkoutScreen() {
  const { t: tr } = useI18n();
  const W = tr.workout;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SessionWithSets | null>(null);
  const [ctx, setCtx] = useState<Context>({ last: new Map(), targets: new Map(), rests: new Map(), bests: new Map() });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupErrors, setGroupErrors] = useState<Record<number, string>>({});
  const [newExercise, setNewExercise] = useState<string | null>(null);
  /** A set picked by tapping its number; otherwise the first unticked set is active. */
  const [picked, setPicked] = useState<string | null>(null);
  /** Finished exercises the user opened again. */
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { showRpe, defaultRest } = usePrefs();
  const restTimer = useRestTimer();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const groupViews = useRef(new Map<number, ComponentRef<typeof View>>());
  const scrolledTo = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getSyncedSession(id);
      setSession(s);
      setLoadError(null);
      setCtx(await loadContext(s));
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    getSyncedSession(id)
      .then(async (s) => {
        if (!active) return;
        setSession(s);
        const c = await loadContext(s);
        if (active) setCtx(c);
      })
      .catch((e) => active && setLoadError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);

  const groups = useMemo(() => (session ? groupSets(session.sets) : []), [session]);
  const total = session?.sets.length ?? 0;
  const done = session?.sets.filter((s) => s.completed) ?? [];
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const volume = done.reduce((t, s) => t + setVolumeKg(s), 0);

  const inProgress = !!session && !session.completed_at;
  const pickedSet = picked ? session?.sets.find((x) => x.id === picked && !x.completed) : undefined;
  const activeId = inProgress
    ? (pickedSet?.id ?? groups.flatMap((g) => g.sets).find((x) => !x.completed)?.id ?? null)
    : null;
  const activeOrder = groups.find((g) => g.sets.some((x) => x.id === activeId))?.order ?? null;

  /** Brings the exercise you're on into view when you move on to it. */
  const scrollToActive = useCallback(() => {
    if (activeOrder === null || scrolledTo.current === activeOrder) return;
    if (!groupViews.current.has(activeOrder)) return;
    scrolledTo.current = activeOrder;
    // Wait for the finished exercise above to collapse, then measure where the card is now
    // (saved layout positions go stale on web, where onLayout ignores moves).
    setTimeout(() => {
      const card = groupViews.current.get(activeOrder);
      const list = scrollRef.current;
      if (!card || !list) return;
      list.measureInWindow((_lx, listY) =>
        card.measureInWindow((_cx, cardY) => {
          const y = cardY - listY + scrollY.current;
          list.scrollTo({ y: Math.max(0, y - space.md), animated: true });
        }),
      );
    }, 100);
  }, [activeOrder]);
  useEffect(scrollToActive, [scrollToActive]);

  const replaceSets = (fn: (sets: SessionSet[]) => SessionSet[]) =>
    setSession((s) => (s ? { ...s, sets: fn(s.sets) } : s));

  /**
   * Optimistic update; rolls back and explains on failure. A new weight or rep count is
   * carried down to the unticked sets below it, and ticking a set starts the rest timer.
   */
  const changeSet = async (set: SessionSet, patch: SetPatch) => {
    const group = groups.find((g) => g.sets.some((x) => x.id === set.id));
    const carry: SetPatch = {};
    if ('weight' in patch) carry.weight = patch.weight;
    if ('reps' in patch) carry.reps = patch.reps;
    const below = Object.keys(carry).length
      ? (group?.sets.slice(group.sets.findIndex((x) => x.id === set.id) + 1).filter((x) => !x.completed) ?? [])
      : [];
    const changes = [{ before: set, patch }, ...below.map((x) => ({ before: x, patch: carry }))];

    replaceSets((sets) =>
      sets.map((x) => {
        const c = changes.find((ch) => ch.before.id === x.id);
        return c ? { ...x, ...c.patch } : x;
      }),
    );
    if (patch.completed) {
      setPicked(null);
      // A set that breaks or ties the best gets a little buzz as its 🏆 / 🔥 appears.
      if (group) {
        const best = ctx.bests.get(group.name);
        const before = comparePb(group.name, group.sets, best);
        const after = comparePb(
          group.name,
          group.sets.map((x) => (x.id === set.id ? { ...x, ...patch } : x)),
          best,
        );
        const rank = (p: typeof before) => (!p ? 0 : p.matched ? 1 : 2);
        if (rank(after) > rank(before)) Vibration.vibrate(rank(after) === 2 ? [0, 60, 60, 120] : 60);
      }
      const anyLeft = session?.sets.some((x) => !x.completed && x.id !== set.id);
      if (inProgress && anyLeft) {
        restTimer.start(ctx.rests.get(set.exercise_name) ?? defaultRest, trName(set.exercise_name));
      }
    }
    try {
      await Promise.all(changes.map((c) => updateSet(c.before.id, c.patch)));
    } catch (e) {
      replaceSets((sets) => sets.map((x) => changes.find((c) => c.before.id === x.id)?.before ?? x));
      Alert.alert(W.couldntSaveSet, errorMessage(e));
    }
  };

  const removeSet = (set: SessionSet) =>
    Alert.alert(W.deleteSetQ, undefined, [
      { text: tr.common.cancel, style: 'cancel' },
      {
        text: tr.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSet(set.id);
            replaceSets((sets) => sets.filter((x) => x.id !== set.id));
          } catch (e) {
            Alert.alert(W.couldntDeleteSet, errorMessage(e));
          }
        },
      },
    ]);

  const appendSet = async (group: ExerciseGroup) => {
    try {
      const created = await addSet(id, group);
      replaceSets((sets) => [...sets, created]);
    } catch (e) {
      Alert.alert(W.couldntAddSet, errorMessage(e));
    }
  };

  /** kg → lb → bodyweight: converts this exercise's weights (95 lb → 43.1 kg) and the plan remembers it. */
  const switchUnit = async (group: ExerciseGroup) => {
    if (!session) return;
    try {
      const updated = await setExerciseUnit(session, group, nextUnit(group.sets[0]?.weight_unit ?? 'kg'));
      const byId = new Map(updated.map((x) => [x.id, x]));
      replaceSets((sets) => sets.map((x) => byId.get(x.id) ?? x));
    } catch (e) {
      Alert.alert(W.couldntSaveSet, errorMessage(e));
    }
  };

  const appendExercise = async () => {
    const name = newExercise ?? '';
    const err = validateName(name, W.exerciseName);
    if (err) return Alert.alert(W.invalidName, err);
    const order = groups.reduce((max, g) => Math.max(max, g.order + 1), 0);
    try {
      const created = await addSessionExercise(id, name, order);
      replaceSets((sets) => [...sets, created]);
      setNewExercise(null);
    } catch (e) {
      Alert.alert(W.couldntAddExercise, errorMessage(e));
    }
  };

  /** Unticked sets are kept, so reopening the workout later shows them again. Then: celebrate. */
  const doFinish = async () => {
    setBusy(true);
    try {
      const completedAt = await finishSession(id);
      setSession((s) => (s ? { ...s, completed_at: completedAt } : s));
      restTimer.stop();
      router.replace(`/celebrate/${id}`);
    } catch (e) {
      Alert.alert(W.couldntFinish, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (!session) return;
    if (done.length === 0) return Alert.alert(W.noSetsDone, W.tickOne);
    const remaining = total - done.length;
    if (remaining === 0) return doFinish();
    Alert.alert(W.finishQ, W.notTicked(remaining), [
      { text: W.keepLogging, style: 'cancel' },
      { text: W.finishAnyway, onPress: doFinish },
    ]);
  };

  const reopen = async () => {
    setBusy(true);
    try {
      await reopenSession(id);
      setSession((s) => (s ? { ...s, completed_at: null } : s));
    } catch (e) {
      Alert.alert(W.couldntReopen, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(W.deleteWorkoutQ, W.deleteWorkoutMsg, [
      { text: tr.common.cancel, style: 'cancel' },
      {
        text: tr.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSession(id);
            router.back();
          } catch (e) {
            Alert.alert(W.couldntDelete, errorMessage(e));
          }
        },
      },
    ]);

  if (!session) {
    return loadError ? (
      <SafeAreaView style={[styles.screen, { padding: space.xl }]}>
        <ErrorBanner message={loadError} onRetry={load} />
        <Button title={tr.common.goBack} variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    ) : (
      <Loading />
    );
  }

  const completed = !!session.completed_at;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={W.close}
            style={s.close}
          >
            <Ionicons name="close" size={24} color={colors.onInk} />
          </Pressable>
          <Text style={s.started}>
            {completed
              ? W.doneIn(formatDuration(session.started_at, session.completed_at!))
              : W.startedAt(formatTime(session.started_at))}
          </Text>
          {completed ? (
            <Pressable onPress={reopen} disabled={busy} accessibilityRole="button" style={[s.pill, s.pillDark]}>
              <Text style={[s.pillText, { color: colors.onInk }]}>{W.reopen}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={finish} disabled={busy} accessibilityRole="button" style={s.pill}>
              <Text style={s.pillText}>{busy ? W.saving : W.finish}</Text>
            </Pressable>
          )}
        </View>
        <View style={{ paddingHorizontal: 8, gap: 10 }}>
          <Text style={s.title}>{trName(session.plan_name, 'plan')}</Text>
          <View style={[styles.row, { gap: 12 }]}>
            <View style={s.track}>
              <View style={[s.bar, { width: `${pct}%` }]} />
            </View>
            <Text style={s.progress}>{W.progress(done.length, total)}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
        >
          {completed ? (
            <View role="status" style={s.saved}>
              <View style={s.savedIcon}>
                <Ionicons name="checkmark" size={18} color={colors.lime} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.savedTitle}>{W.saved}</Text>
                <Text style={s.savedText}>
                  {W.savedSummary(done.length, Math.round(volume).toLocaleString(locale()), WEIGHT_UNIT)}
                </Text>
              </View>
            </View>
          ) : null}

          {groups.map((g) => {
            const last = ctx.last.get(g.name) ?? [];
            const unit = g.sets[0]?.weight_unit ?? 'kg';
            const cardRef = (v: ComponentRef<typeof View> | null) => {
              if (v) groupViews.current.set(g.order, v);
              else groupViews.current.delete(g.order);
            };
            // The first layout of the active card is the earliest moment it can be scrolled to.
            const onLayout = () => {
              if (g.order === activeOrder) scrollToActive();
            };
            const finished = g.sets.length > 0 && g.sets.every((x) => x.completed);
            const pb = comparePb(g.name, g.sets, ctx.bests.get(g.name));
            const badge = pb ? ` ${pb.matched ? PB_MATCHED : PB_BROKEN}` : '';
            if (inProgress && finished && !expanded.has(g.order)) {
              return (
                <Pressable
                  key={g.order}
                  ref={cardRef}
                  onLayout={onLayout}
                  onPress={() => setExpanded((ex) => new Set(ex).add(g.order))}
                  accessibilityRole="button"
                  accessibilityLabel={W.showSets(trName(g.name))}
                  style={[s.exercise, s.collapsed]}
                >
                  <View style={s.collapsedIcon}>
                    <Ionicons name="checkmark" size={16} color={colors.lime} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={s.collapsedTitle} numberOfLines={1}>
                      {trName(g.name)}
                      {badge}
                    </Text>
                    <Text style={styles.small} numberOfLines={1}>
                      {g.sets.map((x) => formatSet({ ...x, rpe: null })).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.muted} />
                </Pressable>
              );
            }
            // A finished exercise the user opened again can be folded back with its header.
            const collapsible = inProgress && finished;
            const collapse = () =>
              setExpanded((ex) => {
                const next = new Set(ex);
                next.delete(g.order);
                return next;
              });
            return (
              <View key={g.order} ref={cardRef} style={s.exercise} onLayout={onLayout}>
                <Pressable
                  onPress={collapsible ? collapse : undefined}
                  disabled={!collapsible}
                  accessibilityRole={collapsible ? 'button' : undefined}
                  accessibilityLabel={collapsible ? W.hideSets(trName(g.name)) : undefined}
                  style={[styles.between, { paddingHorizontal: 2, paddingBottom: 4, alignItems: 'center' }]}
                >
                  <Text style={s.exTitle}>
                    {trName(g.name)}
                    {badge}
                  </Text>
                  {collapsible ? (
                    <Ionicons name="chevron-up" size={18} color={colors.muted} />
                  ) : (
                    <Text style={styles.small}>{ctx.targets.get(g.name) ?? W.nSets(g.sets.length)}</Text>
                  )}
                </Pressable>
                <SetHeader showRpe={showRpe} unit={unit} onUnitPress={() => switchUnit(g)} />
                {g.sets.map((set, i) => (
                  <SetRow
                    key={set.id}
                    index={i}
                    set={set}
                    unit={unit}
                    last={last[i] ? formatSet({ ...last[i], rpe: null }, unit) : ''}
                    active={set.id === activeId}
                    showRpe={showRpe}
                    onActivate={() => setPicked(set.id)}
                    onChange={(patch) => changeSet(set, patch)}
                    onDelete={() => removeSet(set)}
                    onError={(msg) =>
                      setGroupErrors((errs) => {
                        const { [g.order]: _, ...rest } = errs;
                        return msg ? { ...rest, [g.order]: msg } : rest;
                      })
                    }
                  />
                ))}
                {groupErrors[g.order] ? (
                  <Text role="alert" style={[styles.errorText, { paddingHorizontal: 2 }]}>
                    {groupErrors[g.order]}
                  </Text>
                ) : null}
                <Button title={W.addSet} variant="secondary" small onPress={() => appendSet(g)} />
              </View>
            );
          })}

          {newExercise === null ? (
            <Button
              title={W.addExercise}
              variant="dashed"
              icon={<Ionicons name="add" size={18} color={colors.ink} />}
              onPress={() => setNewExercise('')}
              style={{ borderRadius: radius.lg - 2, minHeight: 52 }}
            />
          ) : (
            <View style={s.exercise}>
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>{W.exerciseName}</Text>
                <ExerciseNameInput
                  value={newExercise}
                  onChangeText={setNewExercise}
                  autoFocus
                  placeholder={W.exercisePlaceholder}
                  accessibilityLabel={W.exerciseName}
                  onSubmitEditing={appendExercise}
                  extraNames={groups.map((g) => g.name)}
                  style={styles.input}
                />
              </View>
              <View style={styles.row}>
                <Button
                  title={tr.common.cancel}
                  variant="secondary"
                  small
                  style={{ flex: 1 }}
                  onPress={() => setNewExercise(null)}
                />
                <Button title={tr.common.add} small style={{ flex: 1 }} onPress={appendExercise} />
              </View>
            </View>
          )}

          <Text style={[styles.small, { textAlign: 'center' }]}>{W.tip}</Text>
          <Button title={W.deleteWorkout} variant="danger" onPress={remove} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.ink, paddingHorizontal: 12, paddingBottom: 16, gap: 14 },
  headerBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  started: { fontSize: 14, fontFamily: fonts.semibold, color: colors.onInkMuted },
  pill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDark: { backgroundColor: colors.inkRaised },
  pillText: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.5, color: colors.onInk },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.inkLine, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  progress: { fontSize: 13, fontFamily: fonts.semibold, color: colors.onInk },
  // Extra room at the bottom so the rest timer bar never covers the last set.
  body: { padding: space.lg, gap: 14, paddingBottom: 120 },
  saved: {
    padding: space.lg,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  savedText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  exercise: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
  },
  exTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, flexShrink: 1 },
  collapsed: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.limeSoft },
  collapsedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
