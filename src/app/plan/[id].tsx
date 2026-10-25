import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '@/lib/alert';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deletePlan, formatReps, getPlan, savePlan } from '@/data/plans';
import { startSession } from '@/data/sessions';
import { useI18n } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import { formatRest, parseNumber, parseRepRange, parseRest, validateName } from '@/lib/validation';
import { WEEK_ORDER, today } from '@/lib/days';
import { usePrefs } from '@/lib/prefs';
import { Button, ErrorBanner, Loading, styles } from '@/components/ui';
import { DayPicker } from '@/components/DayPicker';
import { ExerciseNameInput } from '@/components/ExerciseNameInput';
import { colors, fonts, radius, space } from '@/theme';
import { WEIGHT_UNITS } from '@/lib/units';
import { exerciseDefaults, trName } from '@/data/names';
import { checkUnfinished } from '@/lib/unfinished';
import { planLink } from '@/lib/planLink';
import type { DayOfWeek, DraftExercise, PlanExercise, PlanWithExercises, WeightUnit } from '@/lib/types';

/** Editor row: numbers stay as text until save so half-typed values aren't fought. */
interface Row {
  key: string;
  id?: string;
  name: string;
  sets: string;
  /** "10" or a range like "6-8". */
  reps: string;
  /** "1:30" or seconds; blank uses the default rest. */
  rest: string;
  target_weight: number | null;
  weight_unit: WeightUnit;
  per_side: boolean;
}

let rowCounter = 0;
const newKey = () => `row-${++rowCounter}`;
const blankRow = (): Row => ({
  key: newKey(),
  name: '',
  sets: '3',
  reps: '8-12',
  rest: '',
  target_weight: null,
  weight_unit: 'kg',
  per_side: false,
});
const toRow = (e: PlanExercise): Row => ({
  key: e.id,
  id: e.id,
  name: e.name,
  sets: String(e.target_sets),
  reps: formatReps(e).replace('–', '-'),
  rest: e.rest_seconds ? formatRest(e.rest_seconds) : '',
  target_weight: e.target_weight,
  weight_unit: e.weight_unit,
  per_side: e.per_side,
});

export default function PlanEditor() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { defaultRest } = usePrefs();

  const [plan, setPlan] = useState<PlanWithExercises | null>(null);
  const [name, setName] = useState('');
  const [days, setDays] = useState<DayOfWeek[]>([]);
  const [rows, setRows] = useState<Row[]>(() => (isNew ? [blankRow()] : []));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'start' | 'copy' | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  /** Id of a new plan once its first save went through. */
  const savedId = useRef<string | null>(null);

  const apply =(p: PlanWithExercises) => {
    setPlan(p);
    setName(p.name);
    setDays(p.days);
    setRows(p.exercises.map(toRow));
    setLoadError(null);
  };

  const load = async () => {
    try {
      apply(await getPlan(id));
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };

  useEffect(() => {
    if (isNew) return;
    let active = true;
    getPlan(id)
      .then((p) => active && apply(p))
      .catch((e) => active && setLoadError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id, isNew]);

  const updateRow = (key: string, change: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
    if (rowErrors[key]) setRowErrors(({ [key]: _, ...rest }) => rest);
  };

  /** Validates the whole form; returns the cleaned exercise list or null. */
  const validate = (): DraftExercise[] | null => {
    const nErr = validateName(name, t.editor.planName);
    setNameError(nErr ? t.editor.planNameRequired : null);
    const errors: Record<string, string> = {};
    const out: DraftExercise[] = [];
    for (const r of rows) {
      const err = validateName(r.name, t.editor.exerciseName);
      const sets = parseNumber(r.sets, { label: t.editor.sets, min: 1, max: 20, integer: true, required: true });
      const reps = parseRepRange(r.reps);
      const rest = parseRest(r.rest);
      if (err) errors[r.key] = err;
      else if (!sets.ok) errors[r.key] = sets.error;
      else if (!reps.ok) errors[r.key] = reps.error;
      else if (!rest.ok) errors[r.key] = rest.error;
      else
        out.push({
          id: r.id,
          name: r.name.trim(),
          target_sets: sets.value!,
          target_reps: reps.min,
          target_reps_max: reps.max,
          target_weight: r.target_weight,
          rest_seconds: rest.value,
          weight_unit: r.weight_unit,
          per_side: r.per_side,
        });
    }
    setRowErrors(errors);
    return nErr || Object.keys(errors).length > 0 ? null : out;
  };

  const persist = async (): Promise<string | null> => {
    const exercises = validate();
    if (!exercises) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return null;
    }
    const planId = await savePlan(savedId.current ?? (isNew ? null : id), { name, days, exercises }, plan?.exercises ?? []);
    // A new plan exists from now on: later saves (or a retried Start) update it instead of
    // creating another, and the reloaded rows carry their ids.
    if (!savedId.current && isNew) {
      savedId.current = planId;
      apply(await getPlan(planId));
    }
    return planId;
  };

  /** Back to wherever the editor was opened from; the Plans list when it was opened directly. */
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/plans'));

  const save = async () => {
    setBusy('save');
    try {
      if (await persist()) leave();
    } catch (e) {
      Alert.alert(t.editor.couldntSave, errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const startNow = async () => {
    const other = await checkUnfinished(name);
    if (other.action === 'cancel') return;
    if (other.action === 'resume') return router.replace(`/workout/${other.id}`);
    setBusy('start');
    try {
      const planId = await persist();
      if (!planId) return;
      const sessionId = await startSession(planId);
      router.replace(`/workout/${sessionId}`);
    } catch (e) {
      Alert.alert(t.home.couldntStart, errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  /** Starting creates a real workout for today, so confirm when the plan isn't scheduled today. */
  const confirmStart = () => {
    if (rows.length === 0) return Alert.alert(t.editor.noExercisesYet, t.editor.addOneFirst);
    if (days.includes(today())) return startNow();
    Alert.alert(t.editor.startTodayQ, t.editor.startTodayMsg(trName(name.trim(), 'plan') || '—'), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.editor.startNow, onPress: startNow },
    ]);
  };

  /** Moves an exercise one place up or down; the new order is saved with the plan. */
  const move = (index: number, by: -1 | 1) =>
    setRows((rs) => {
      const to = index + by;
      if (to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  /** Saves any edits, then makes a copy of the plan (not scheduled, so it doesn't double up on Home). */
  const duplicate = async () => {
    setBusy('copy');
    try {
      const exercises = validate();
      if (!exercises) return;
      const copyId = await savePlan(null, { name: t.planShare.copyName(name.trim()).slice(0, 60), days: [], exercises: exercises.map(({ id: _, ...e }) => e) });
      Alert.alert(t.planShare.duplicated);
      router.replace(`/plan/${copyId}`);
    } catch (e) {
      Alert.alert(t.editor.couldntSave, errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  /** A link with the whole plan in it; on the web it goes to the share sheet, or the clipboard. */
  const share = async () => {
    if (!plan) return;
    const link = planLink({ ...plan, exercises: plan.exercises });
    const text = t.planShare.shareText(trName(plan.name, 'plan'));
    try {
      if (Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator)) {
        await Share.share({ message: `${text}\n${link}`, url: link });
        return;
      }
      await Clipboard.setStringAsync(link);
      Alert.alert(t.planShare.linkCopied, t.planShare.linkCopiedMsg);
    } catch {
      // Closing the share sheet isn't an error.
    }
  };

  const confirmDelete = () =>
    Alert.alert(t.editor.deletePlanQ, t.editor.deletePlanMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlan(id);
            leave();
          } catch (e) {
            Alert.alert(t.editor.couldntDelete, errorMessage(e));
          }
        },
      },
    ]);

  if (!isNew && !plan) {
    return loadError ? (
      <View style={[styles.screen, { padding: space.xl }]}>
        <ErrorBanner message={loadError} onRetry={load} />
      </View>
    ) : (
      <Loading />
    );
  }

  const picked = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => t.days.long[d]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? t.editor.newTitle : t.editor.editTitle,
          headerRight: () => (
            <Button
              title={t.common.save}
              small
              pill
              onPress={save}
              loading={busy === 'save'}
              disabled={busy !== null}
            />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { gap: space.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space.sm }}>
            <Text style={styles.label}>{t.editor.planName}</Text>
            <ExerciseNameInput
              kind="plan"
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(null);
              }}
              placeholder={t.editor.planNamePlaceholder}
              autoFocus={isNew}
              accessibilityLabel={t.editor.planName}
              style={[s.nameInput, !!nameError && { borderColor: colors.danger }]}
            />
            {nameError ? (
              <Text role="alert" style={styles.errorText}>
                {nameError}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <Text style={styles.label}>{t.editor.scheduledDays}</Text>
            <DayPicker value={days} onChange={setDays} />
            <Text style={styles.small}>{picked.length ? t.editor.showsOnHome(picked) : t.editor.notScheduledHint}</Text>
          </View>

          <View style={{ gap: 10 }}>
            <View style={styles.between}>
              <Text style={styles.label}>{t.editor.exercises}</Text>
              <Text style={styles.small}>{t.plans.nExercises(rows.length)}</Text>
            </View>

            {rows.map((r, i) => (
              <View key={r.key} style={[s.exCard, !!rowErrors[r.key] && { borderColor: colors.danger }]}>
                <View style={[styles.row, { gap: 8, alignItems: 'flex-start' }]}>
                  <View style={s.num}>
                    <Text style={s.numText}>{i + 1}</Text>
                  </View>
                  <ExerciseNameInput
                    value={r.name}
                    onChangeText={(v) => updateRow(r.key, { name: v, ...exerciseDefaults(v, r) })}
                    placeholder={t.editor.exerciseName}
                    accessibilityLabel={`${t.editor.exerciseN(i + 1)}: ${t.editor.exerciseName}`}
                    autoFocus={!r.id && r.name === '' && i > 0}
                    extraNames={rows.map((x) => x.name).filter((n) => n.trim() !== '')}
                    style={s.exName}
                  />
                  <View style={s.moves}>
                    <Pressable
                      onPress={() => move(i, -1)}
                      disabled={i === 0}
                      accessibilityRole="button"
                      accessibilityLabel={t.planShare.moveUp(i + 1)}
                      style={[s.move, i === 0 && { opacity: 0.25 }]}
                    >
                      <Ionicons name="chevron-up" size={18} color={colors.ink} />
                    </Pressable>
                    <Pressable
                      onPress={() => move(i, 1)}
                      disabled={i === rows.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={t.planShare.moveDown(i + 1)}
                      style={[s.move, i === rows.length - 1 && { opacity: 0.25 }]}
                    >
                      <Ionicons name="chevron-down" size={18} color={colors.ink} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    accessibilityRole="button"
                    accessibilityLabel={t.editor.removeExercise(i + 1)}
                    style={s.trash}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={s.targets}>
                  <View style={[s.target, { flex: 0.8 }]}>
                    <Text style={s.targetLabel}>{t.editor.sets}</Text>
                    <TextInput
                      value={r.sets}
                      onChangeText={(v) => updateRow(r.key, { sets: v })}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      accessibilityLabel={`${t.editor.exerciseN(i + 1)}: ${t.editor.sets}`}
                      style={s.targetInput}
                    />
                  </View>
                  <View style={[s.target, { flex: 1.25 }]}>
                    <Text style={s.targetLabel}>{t.editor.reps}</Text>
                    <TextInput
                      value={r.reps}
                      onChangeText={(v) => updateRow(r.key, { reps: v })}
                      keyboardType="numbers-and-punctuation"
                      selectTextOnFocus
                      accessibilityLabel={`${t.editor.exerciseN(i + 1)}: ${t.editor.reps}`}
                      accessibilityHint={t.editor.repsHint}
                      style={s.targetInput}
                    />
                  </View>
                  <View style={[s.target, { flex: 0.95 }]}>
                    <Text style={s.targetLabel}>{t.editor.rest}</Text>
                    <TextInput
                      value={r.rest}
                      onChangeText={(v) => updateRow(r.key, { rest: v })}
                      keyboardType="numbers-and-punctuation"
                      selectTextOnFocus
                      placeholder={formatRest(defaultRest)}
                      placeholderTextColor={colors.faint}
                      accessibilityLabel={`${t.editor.exerciseN(i + 1)}: ${t.editor.rest}`}
                      accessibilityHint={t.editor.restHint}
                      style={s.targetInput}
                    />
                  </View>
                </View>
                <View style={s.options}>
                  <View style={s.segment} accessibilityRole="radiogroup" accessibilityLabel={`${t.editor.exerciseN(i + 1)}: ${t.editor.unit}`}>
                    {WEIGHT_UNITS.map((u) => {
                      const on = r.weight_unit === u;
                      return (
                        <Pressable
                          key={u}
                          onPress={() => updateRow(r.key, { weight_unit: u })}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={[s.segBtn, on && s.segBtnOn]}
                        >
                          <Text style={[s.segText, on && s.segTextOn]}>{u === 'bw' ? t.sets.bodyweight : u}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {r.weight_unit !== 'bw' ? (
                    <Pressable
                      onPress={() => updateRow(r.key, { per_side: !r.per_side })}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: r.per_side }}
                      accessibilityLabel={`${t.editor.exerciseN(i + 1)}: ${t.editor.perHand}`}
                      accessibilityHint={t.editor.perHandHint}
                      style={[s.perHand, r.per_side && s.segBtnOn]}
                    >
                      <Ionicons name={r.per_side ? 'checkbox' : 'square-outline'} size={16} color={r.per_side ? colors.lime : colors.muted} />
                      <Text style={[s.segText, r.per_side && s.segTextOn]}>{t.editor.perHand}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {rowErrors[r.key] ? (
                  <Text role="alert" style={[styles.errorText, { paddingLeft: 36 }]}>
                    {rowErrors[r.key]}
                  </Text>
                ) : null}
              </View>
            ))}

            <Text style={styles.small}>
              {t.editor.repsHint} {t.editor.restHint}
            </Text>
            <Button
              title={t.editor.addExercise}
              variant="dashed"
              icon={<Ionicons name="add" size={18} color={colors.ink} />}
              onPress={() => setRows((rs) => [...rs, blankRow()])}
              style={{ borderRadius: radius.lg - 2, minHeight: 52 }}
            />
          </View>

          <View style={{ gap: space.sm }}>
            <Button title={t.editor.savePlan} onPress={save} loading={busy === 'save'} disabled={busy !== null} />
            {!isNew ? (
              <Button
                title={t.editor.startNow}
                variant="white"
                icon={<Ionicons name="play" size={16} color={colors.ink} />}
                onPress={confirmStart}
                loading={busy === 'start'}
                disabled={busy !== null}
              />
            ) : null}
            {!isNew ? (
              <View style={styles.row}>
                <Button
                  title={t.planShare.duplicate}
                  variant="secondary"
                  small
                  icon={<Ionicons name="copy-outline" size={16} color={colors.ink} />}
                  onPress={duplicate}
                  loading={busy === 'copy'}
                  disabled={busy !== null}
                  style={{ flex: 1 }}
                />
                <Button
                  title={t.planShare.share}
                  variant="secondary"
                  small
                  icon={<Ionicons name="share-outline" size={16} color={colors.ink} />}
                  onPress={share}
                  disabled={busy !== null || !plan}
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
            {!isNew ? (
              <Button title={t.editor.deletePlan} variant="danger" onPress={confirmDelete} disabled={busy !== null} />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  nameInput: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  exCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    padding: space.md,
    gap: 10,
  },
  num: {
    marginTop: 6,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
  exName: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 4,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  trash: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moves: { flexDirection: 'row' },
  move: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  targets: { flexDirection: 'row', gap: 6, paddingLeft: 36 },
  target: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  options: { flexDirection: 'row', gap: 6, paddingLeft: 36, flexWrap: 'wrap' },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 3, gap: 2 },
  segBtn: { minWidth: 44, height: 38, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: colors.ink },
  segText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.muted },
  segTextOn: { color: colors.lime },
  perHand: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    textAlign: 'right',
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
});
