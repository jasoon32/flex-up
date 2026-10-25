import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addSessionExercise,
  addSet,
  addWarmups,
  deleteSession,
  deleteSet,
  finishSession,
  formatSet,
  getLastSets,
  getSession,
  groupSets,
  reopenSession,
  saveSessionAsPlan,
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
import { getExerciseNotes, saveExerciseNote, saveWorkoutNote } from '@/data/notes';
import { suggestNext, type Suggestion } from '@/lib/progression';
import { warmupSets } from '@/lib/warmup';
import { BARS, loadBar } from '@/lib/plates';

interface Context {
  /** Last session's completed sets per exercise name. */
  last: Map<string, SessionSet[]>;
  /** Plan targets per exercise name, e.g. "4 × 6". */
  targets: Map<string, string>;
  /** Plan rest times in seconds per exercise name; missing or null uses the default. */
  rests: Map<string, number | null>;
  /** Bests from earlier workouts, for 🏆 / 🔥 as sets are ticked. */
  bests: Map<string, Best>;
  /** Plan rep ranges per exercise name, for the next-weight suggestion. */
  ranges: Map<string, { min: number; max: number }>;
  /** Sticky notes per exercise name ("seat on 4"). */
  notes: Map<string, string>;
}

const emptyContext = (): Context => ({
  last: new Map(),
  targets: new Map(),
  rests: new Map(),
  bests: new Map(),
  ranges: new Map(),
  notes: new Map(),
});

/** Plate colours by size, heaviest first, as most gyms paint them. */
const PLATE_COLORS = ['#D64545', '#2F6FD6', '#E8B931', '#3E9B4F', '#FFFFFF', '#3A3A36', '#B5B5AE'];

async function loadContext(session: SessionWithSets): Promise<Context> {
  const names = [...new Set(session.sets.map((s) => s.exercise_name))];
  const [last, plan, bests, notes] = await Promise.all([
    getLastSets(names, session.started_at).catch(() => new Map<string, SessionSet[]>()),
    session.plan_id ? getPlan(session.plan_id).catch(() => null) : Promise.resolve(null),
    getBestsBefore(names, session.started_at).catch(() => new Map<string, Best>()),
    getExerciseNotes(names).catch(() => new Map<string, string>()),
  ]);
  const exercises = plan?.exercises ?? [];
  const targets = new Map(exercises.map((e) => [e.name, formatTarget(e)]));
  const rests = new Map(exercises.map((e) => [e.name, e.rest_seconds]));
  const ranges = new Map(exercises.map((e) => [e.name, { min: e.target_reps, max: e.target_reps_max ?? e.target_reps }]));
  return { last, targets, rests, bests, ranges, notes };
}

/** Loads a session; an unfinished one first picks up any edits made to its plan since it started. */
async function getSyncedSession(id: string): Promise<SessionWithSets> {
  const s = await getSession(id);
  const changed = await syncSessionWithPlan(s).catch(() => false);
  return changed ? getSession(id) : s;
}

/** Back to wherever the workout was opened from; Home when it was opened directly (web refresh, link). */
const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function WorkoutScreen() {
  const { t: tr } = useI18n();
  const W = tr.workout;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SessionWithSets | null>(null);
  const [ctx, setCtx] = useState<Context>(emptyContext);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupErrors, setGroupErrors] = useState<Record<number, string>>({});
  const [newExercise, setNewExercise] = useState<string | null>(null);
  /** A set picked by tapping its number; otherwise the first unticked set is active. */
  const [picked, setPicked] = useState<string | null>(null);
  /** Finished exercises the user opened again. */
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  /** The exercise whose plate calculator or note editor is open. */
  const [tool, setTool] = useState<{ order: number; kind: 'plates' | 'note' } | null>(null);
  const [noteText, setNoteText] = useState('');
  /** Bar weight picked in the plate calculator; the unit's standard bar until changed. */
  const [bar, setBar] = useState<number | null>(null);
  /** The workout note as typed; saved when the box loses focus. */
  const [workoutNote, setWorkoutNote] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const { showRpe, defaultRest, weightStep, weightStepLb } = usePrefs();
  const TL = tr.tools;
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
        if (s.sets.length === 0 && !s.completed_at) setNewExercise('');
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
    const below =
      Object.keys(carry).length && set.set_type !== 'warmup'
        ? (group?.sets
            .slice(group.sets.findIndex((x) => x.id === set.id) + 1)
            .filter((x) => !x.completed && x.set_type !== 'warmup') ?? [])
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
        const rest = ctx.rests.get(set.exercise_name) ?? defaultRest;
        // Warm-ups need only a short breather.
        restTimer.start(set.set_type === 'warmup' ? Math.min(60, rest) : rest, trName(set.exercise_name));
      }
    }
    try {
      await Promise.all(changes.map((c) => updateSet(c.before.id, c.patch)));
    } catch (e) {
      replaceSets((sets) => sets.map((x) => changes.find((c) => c.before.id === x.id)?.before ?? x));
      // The tick was undone, so the rest it started no longer applies.
      if (patch.completed) restTimer.stop();
      Alert.alert(W.couldntSaveSet, errorMessage(e));
    }
  };

  const deleteSetNow = async (set: SessionSet) => {
    try {
      await deleteSet(set.id);
      replaceSets((sets) => sets.filter((x) => x.id !== set.id));
    } catch (e) {
      Alert.alert(W.couldntDeleteSet, errorMessage(e));
    }
  };

  /** Long-press on a set number: change what kind of set it is, or delete it. */
  const openSetMenu = (set: SessionSet, label: string) =>
    Alert.alert(TL.setMenu(label), TL.setMenuMsg, [
      ...(['normal', 'warmup', 'drop', 'failure'] as const)
        .filter((k) => k !== set.set_type)
        .map((k) => ({ text: TL.setTypes[k], onPress: () => changeSet(set, { set_type: k }) })),
      { text: TL.deleteSet, style: 'destructive' as const, onPress: () => deleteSetNow(set) },
      { text: tr.common.cancel, style: 'cancel' as const },
    ]);

  /** Fills the exercise's unticked working sets with the suggested weight and reps. */
  const applySuggestion = async (group: ExerciseGroup, sug: Suggestion) => {
    const targets = group.sets.filter((x) => !x.completed && x.set_type !== 'warmup');
    const patch: SetPatch = { reps: sug.reps, ...(sug.weight !== null ? { weight: sug.weight } : {}) };
    replaceSets((sets) => sets.map((x) => (targets.some((y) => y.id === x.id) ? { ...x, ...patch } : x)));
    try {
      await Promise.all(targets.map((x) => updateSet(x.id, patch)));
    } catch (e) {
      replaceSets((sets) => sets.map((x) => targets.find((y) => y.id === x.id) ?? x));
      Alert.alert(W.couldntSaveSet, errorMessage(e));
    }
  };

  /** Warm-up sets worked out from the first working set's weight, put in front of it. */
  const addWarmup = async (group: ExerciseGroup, step: number) => {
    const working = group.sets.find((x) => x.set_type !== 'warmup' && x.weight);
    const list = working?.weight ? warmupSets(working.weight, step) : [];
    if (list.length === 0) return Alert.alert(TL.warmup, TL.warmupNone);
    try {
      const updated = await addWarmups(id, group, list);
      const ids = new Set(updated.map((x) => x.id));
      replaceSets((sets) => [...sets.filter((x) => !ids.has(x.id)), ...updated]);
    } catch (e) {
      Alert.alert(W.couldntAddSet, errorMessage(e));
    }
  };

  const openNote = (group: ExerciseGroup) => {
    if (tool?.order === group.order && tool.kind === 'note') return setTool(null);
    setNoteText(ctx.notes.get(group.name) ?? '');
    setTool({ order: group.order, kind: 'note' });
  };

  const saveNote = async (group: ExerciseGroup) => {
    const text = noteText.trim().slice(0, 300);
    try {
      await saveExerciseNote(group.name, text);
      setCtx((c) => {
        const notes = new Map(c.notes);
        if (text) notes.set(group.name, text);
        else notes.delete(group.name);
        return { ...c, notes };
      });
      setTool(null);
    } catch (e) {
      Alert.alert(TL.couldntSaveNote, errorMessage(e));
    }
  };

  const commitWorkoutNote = async () => {
    if (workoutNote === null || !session || workoutNote.trim() === (session.notes ?? '')) return;
    try {
      await saveWorkoutNote(id, workoutNote.slice(0, 500));
      setSession((s) => (s ? { ...s, notes: workoutNote.trim() || null } : s));
    } catch (e) {
      Alert.alert(TL.couldntSaveNote, errorMessage(e));
    }
  };

  const saveAsPlan = async () => {
    if (!session) return;
    setSavingPlan(true);
    try {
      const planId = await saveSessionAsPlan(session);
      setSession((s) => (s ? { ...s, plan_id: planId } : s));
      Alert.alert(tr.quick.savedAsPlan, tr.quick.savedAsPlanMsg);
    } catch (e) {
      Alert.alert(tr.quick.couldntSave, errorMessage(e));
    } finally {
      setSavingPlan(false);
    }
  };

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
      // Last time, records and notes were loaded for the exercises the workout started with;
      // fetch them for the new one too, so its "Last" column and suggestion work.
      if (session) {
        const fresh = await loadContext({ ...session, sets: [...session.sets, created] }).catch(() => null);
        if (fresh) setCtx(fresh);
      }
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
            leave();
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
        <Button title={tr.common.goBack} variant="ghost" onPress={() => leave()} />
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
            onPress={() => leave()}
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
            const perSide = g.sets[0]?.per_side ?? false;
            const step = unit === 'lb' ? weightStepLb : weightStep;
            // Warm-ups show "W"; working sets are numbered on their own, with D / F for drop and failure sets.
            let n = 0;
            const labels = g.sets.map((x) =>
              x.set_type === 'warmup' ? TL.setTypeShort.warmup : `${++n}${TL.setTypeShort[x.set_type]}`,
            );
            let w = 0;
            const lastFor = g.sets.map((x) => (x.set_type === 'warmup' ? undefined : last[w++]));
            const openWorking = g.sets.filter((x) => !x.completed && x.set_type !== 'warmup');
            const sug = inProgress && openWorking.length ? suggestNext(last, ctx.ranges.get(g.name) ?? null, unit, step) : null;
            const sugText = sug
              ? `${sug.weight !== null ? `${sug.weight} ${unit === 'bw' ? '+kg' : unit}` : tr.units.bodyweight} × ${sug.reps}`
              : '';
            const sugApplied =
              !!sug && openWorking.every((x) => x.reps === sug.reps && (sug.weight === null || x.weight === sug.weight));
            const note = ctx.notes.get(g.name);
            const noteOpen = tool?.order === g.order && tool.kind === 'note';
            const platesOpen = tool?.order === g.order && tool.kind === 'plates';
            const canPlates = (unit === 'kg' || unit === 'lb') && !perSide;
            const canWarmup = unit !== 'bw' && !g.sets.some((x) => x.set_type === 'warmup');
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
                {note && !noteOpen ? (
                  <Pressable onPress={() => openNote(g)} accessibilityRole="button" accessibilityLabel={TL.noteLabel(trName(g.name))} style={s.note}>
                    <Ionicons name="document-text-outline" size={14} color={colors.warn} />
                    <Text style={s.noteText}>{note}</Text>
                  </Pressable>
                ) : null}
                {noteOpen ? (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      value={noteText}
                      onChangeText={setNoteText}
                      placeholder={TL.notePlaceholder}
                      placeholderTextColor={colors.faint}
                      multiline
                      maxLength={300}
                      autoFocus
                      accessibilityLabel={TL.noteLabel(trName(g.name))}
                      style={[styles.input, s.noteInput]}
                    />
                    <View style={styles.row}>
                      <Button title={tr.common.cancel} variant="secondary" small style={{ flex: 1 }} onPress={() => setTool(null)} />
                      <Button title={tr.common.save} small style={{ flex: 1 }} onPress={() => saveNote(g)} />
                    </View>
                  </View>
                ) : null}
                {sug ? (
                  <View style={s.suggest}>
                    <Ionicons name={sug.kind === 'weight' ? 'trending-up' : 'repeat'} size={18} color={colors.ink} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={s.suggestTitle}>{TL.next(sugText)}</Text>
                      <Text style={s.suggestText}>{sug.kind === 'weight' ? TL.suggestUp : TL.suggestReps}</Text>
                    </View>
                    {!sugApplied ? (
                      <Pressable
                        onPress={() => applySuggestion(g, sug)}
                        accessibilityRole="button"
                        accessibilityLabel={TL.applyLabel(sugText)}
                        style={s.useBtn}
                      >
                        <Text style={s.useText}>{TL.use}</Text>
                      </Pressable>
                    ) : (
                      <Ionicons name="checkmark-circle" size={22} color={colors.ink} />
                    )}
                  </View>
                ) : null}
                {platesOpen ? (
                  <PlatePanel
                    weight={(g.sets.find((x) => x.id === activeId) ?? openWorking[0] ?? g.sets[g.sets.length - 1])?.weight ?? 0}
                    unit={unit === 'lb' ? 'lb' : 'kg'}
                    bar={bar}
                    onBar={setBar}
                  />
                ) : null}
                <SetHeader showRpe={showRpe} unit={unit} onUnitPress={() => switchUnit(g)} />
                {g.sets.map((set, i) => (
                  <SetRow
                    key={set.id}
                    index={i}
                    label={labels[i]}
                    set={set}
                    unit={unit}
                    last={lastFor[i] ? formatSet({ ...lastFor[i]!, rpe: null }, unit) : ''}
                    active={set.id === activeId}
                    showRpe={showRpe}
                    onActivate={() => setPicked(set.id)}
                    onChange={(patch) => changeSet(set, patch)}
                    onDelete={() => openSetMenu(set, labels[i])}
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
                <View style={s.toolRow}>
                  {inProgress && canWarmup ? (
                    <ToolChip icon="flame-outline" label={TL.warmup} a11y={TL.warmupLabel(trName(g.name))} onPress={() => addWarmup(g, step)} />
                  ) : null}
                  {canPlates ? (
                    <ToolChip
                      icon="disc-outline"
                      label={TL.plates}
                      a11y={TL.platesLabel(trName(g.name))}
                      on={platesOpen}
                      onPress={() => setTool(platesOpen ? null : { order: g.order, kind: 'plates' })}
                    />
                  ) : null}
                  <ToolChip icon="create-outline" label={TL.note} a11y={TL.noteLabel(trName(g.name))} on={noteOpen} onPress={() => openNote(g)} />
                  <ToolChip
                    icon="stats-chart-outline"
                    a11y={tr.exercise.history}
                    onPress={() => router.push({ pathname: '/exercise/[name]', params: { name: g.name } })}
                  />
                </View>
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

          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{TL.workoutNotes}</Text>
            <TextInput
              value={workoutNote ?? session.notes ?? ''}
              onChangeText={setWorkoutNote}
              onBlur={commitWorkoutNote}
              placeholder={TL.workoutNotesPlaceholder}
              placeholderTextColor={colors.faint}
              multiline
              maxLength={500}
              accessibilityLabel={TL.workoutNotes}
              style={[styles.input, s.noteInput]}
            />
          </View>

          {completed && !session.plan_id ? (
            <View style={{ gap: 6 }}>
              <Button
                title={tr.quick.saveAsPlan}
                variant="white"
                icon={<Ionicons name="bookmark-outline" size={18} color={colors.ink} />}
                onPress={saveAsPlan}
                loading={savingPlan}
              />
              <Text style={[styles.small, { textAlign: 'center' }]}>{tr.quick.saveAsPlanHint}</Text>
            </View>
          ) : null}

          <Text style={[styles.small, { textAlign: 'center' }]}>{W.tip}</Text>
          <Button title={W.deleteWorkout} variant="danger" onPress={remove} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ToolChip({
  icon,
  label,
  a11y,
  on,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  a11y: string;
  on?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={on === undefined ? undefined : { expanded: on }}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={16} color={on ? colors.lime : colors.ink} />
      {label ? <Text style={[s.chipText, on && { color: colors.lime }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** Which plates go on each side of the bar for a set's weight. */
function PlatePanel({
  weight,
  unit,
  bar,
  onBar,
}: {
  weight: number;
  unit: 'kg' | 'lb';
  bar: number | null;
  onBar: (w: number) => void;
}) {
  const TL = useI18n().t.tools;
  const bars = BARS[unit] as readonly number[];
  const barWeight = bar !== null && bars.includes(bar) ? bar : bars[0];
  const load = loadBar(weight, barWeight, unit);
  const sizes = (unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]) as number[];
  return (
    <View style={s.plates}>
      <View style={styles.between}>
        <Text style={s.platesTitle}>{TL.loadFor(`${weight} ${unit}`)}</Text>
        <View style={[styles.row, { gap: 4 }]} accessibilityRole="radiogroup" accessibilityLabel={TL.bar}>
          <Text style={styles.small}>{TL.bar}</Text>
          {bars.map((b) => (
            <Pressable
              key={b}
              onPress={() => onBar(b)}
              accessibilityRole="radio"
              accessibilityState={{ checked: b === barWeight }}
              style={[s.barChip, b === barWeight && s.chipOn]}
            >
              <Text style={[s.chipText, b === barWeight && { color: colors.lime }]}>{b}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {load.perSide.length === 0 ? (
        <Text style={styles.small}>{TL.barOnly}</Text>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={styles.small}>{TL.perSide}</Text>
          <View style={s.plateRow}>
            {load.perSide.map((p, i) => {
              const k = Math.max(0, sizes.indexOf(p));
              return (
                <View
                  key={i}
                  style={[
                    s.plate,
                    { height: 28 + (sizes.length - k) * 6, backgroundColor: PLATE_COLORS[k] ?? colors.faint },
                  ]}
                >
                  <Text style={[s.plateText, (k === 4 || k === 6) && { color: colors.ink }]}>{p}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      {load.leftover > 0 ? <Text style={[styles.small, { color: colors.warn }]}>{TL.leftover(`${load.leftover} ${unit}`)}</Text> : null}
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
  note: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: colors.warnSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.warn },
  noteInput: { height: undefined, minHeight: 72, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.limeSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  suggestText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  useBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useText: { fontFamily: fonts.bold, fontSize: 13, color: colors.lime },
  toolRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  chip: {
    flexGrow: 1,
    height: 40,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  plates: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, gap: 8 },
  platesTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  barChip: {
    height: 32,
    minWidth: 36,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  plate: {
    width: 30,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: { fontFamily: fonts.bold, fontSize: 10, color: colors.onInk },
});
