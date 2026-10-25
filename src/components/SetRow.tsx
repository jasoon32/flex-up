import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/theme';
import { numText, parseReps, parseRpe, parseWeight, type Parsed } from '@/lib/validation';
import type { SessionSet, SetPatch, WeightUnit } from '@/lib/types';
import { UNIT_STEPS, unitLabel } from '@/lib/units';
import { useI18n } from '@/i18n';
import { setPrefs, usePrefs } from '@/lib/prefs';

interface Props {
  index: number;
  /** What the set-number button shows: "1", "W" for a warm-up, "2D" for a drop set. Defaults to index + 1. */
  label?: string;
  set: SessionSet;
  /** The exercise's unit; 'bw' allows a blank weight (bodyweight). */
  unit: WeightUnit;
  /** What was lifted for this set last time, e.g. "77.5×6". */
  last: string;
  /** The set you're on: highlighted, with − / + steppers under it. */
  active: boolean;
  showRpe: boolean;
  onActivate: () => void;
  onChange: (patch: SetPatch) => void;
  onDelete: () => void;
  onError: (message: string | null) => void;
}

type Field = 'weight' | 'reps' | 'rpe';
type StepField = 'weight' | 'reps';
const FIELDS: Field[] = ['weight', 'reps', 'rpe'];
const parsers: Record<Field, (t: string) => Parsed> = { weight: parseWeight, reps: parseReps, rpe: parseRpe };
/** Stepper taps are saved together once you stop tapping. */
const STEP_SAVE_MS = 600;

/** One editable set. Fields save when they lose focus; ticking done also saves anything still being typed. */
export function SetRow({ index, label, set, unit, last, active, showRpe, onActivate, onChange, onDelete, onError }: Props) {
  const { t: tr } = useI18n();
  const L = tr.sets;
  const prefs = usePrefs();
  const weightStep = unit === 'lb' ? prefs.weightStepLb : prefs.weightStep;
  const steps = UNIT_STEPS[unit];
  const pickStep = (w: number) => setPrefs(unit === 'lb' ? { weightStepLb: w } : { weightStep: w });
  const shown = unitLabel(unit);
  const STEP: Record<StepField, number> = { weight: weightStep, reps: 1 };
  const [text, setText] = useState({ weight: numText(set.weight), reps: numText(set.reps), rpe: numText(set.rpe) });
  const [synced, setSynced] = useState({ weight: set.weight, reps: set.reps, rpe: set.rpe });
  const pending = useRef<SetPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // When a saved value changes from outside (e.g. a failed save is rolled back, or a value is
  // carried down from the set above), refresh only that field's text so typing elsewhere isn't lost.
  const changed = FIELDS.filter((f) => synced[f] !== set[f]);
  if (changed.length > 0) {
    setSynced({ weight: set.weight, reps: set.reps, rpe: set.rpe });
    setText((t) => {
      const next = { ...t };
      for (const f of changed) next[f] = numText(set[f]);
      return next;
    });
  }

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length > 0) onChangeRef.current(patch);
  }, []);
  // Save stepper taps that are still waiting when the row goes away.
  useEffect(() => flush, [flush]);

  const commit = (field: Field) => {
    const parsed = parsers[field](text[field]);
    if (!parsed.ok) {
      Alert.alert(tr.common.invalidValue, parsed.error);
      setText((t) => ({ ...t, [field]: numText(set[field]) }));
      return;
    }
    if (parsed.value !== set[field]) onChange({ [field]: parsed.value });
    setText((t) => ({ ...t, [field]: numText(parsed.value) }));
  };

  const step = (field: StepField, dir: 1 | -1) => {
    const parsed = parsers[field](text[field]);
    const from = (parsed.ok ? parsed.value : set[field]) ?? 0;
    const raw = Math.max(0, Math.round((from + dir * STEP[field]) * 100) / 100);
    // Weight 0 means bodyweight, which is stored as empty.
    const value = field === 'weight' && raw === 0 ? null : raw;
    setText((t) => ({ ...t, [field]: numText(value) }));
    pending.current = { ...pending.current, [field]: value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, STEP_SAVE_MS);
    if (field === 'reps') onError(null);
  };

  const n = index + 1;

  const toggle = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = {};
    const patch: Record<string, number | null | boolean> = {};
    for (const f of FIELDS) {
      const parsed = parsers[f](text[f]);
      if (!parsed.ok) {
        Alert.alert(tr.common.invalidValue, parsed.error);
        return;
      }
      if (parsed.value !== set[f]) patch[f] = parsed.value;
    }
    // Unticking asks first, so a stray tap doesn't quietly drop a logged set.
    if (set.completed) {
      Alert.alert(L.untickQ(n), L.untickMsg, [
        { text: tr.common.cancel, style: 'cancel' },
        { text: L.untick, style: 'destructive', onPress: () => onChange({ ...(patch as SetPatch), completed: false }) },
      ]);
      return;
    }
    const reps = 'reps' in patch ? (patch.reps as number | null) : set.reps;
    const weight = 'weight' in patch ? (patch.weight as number | null) : set.weight;
    const missing = reps === null ? L.enterRepsFirst : unit !== 'bw' && weight === null ? L.enterWeightFirst : null;
    if (missing) {
      onError(missing);
      if (Object.keys(patch).length > 0) onChange(patch as SetPatch);
      return;
    }
    onError(null);
    onChange({ ...(patch as SetPatch), completed: true });
  };

  const input = (field: Field, keyboard: 'decimal-pad' | 'number-pad', label: string, placeholder = '') => (
    <TextInput
      value={text[field]}
      onChangeText={(v) => setText((t) => ({ ...t, [field]: v }))}
      // onBlur fires on web as well as phones; onEndEditing never fires on web.
      onBlur={() => commit(field)}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType={keyboard}
      selectTextOnFocus
      returnKeyType="done"
      style={[s.input, set.completed && s.inputDone]}
      accessibilityLabel={label}
    />
  );

  const stepper = (field: StepField, label: string) => (
    <View style={s.stepper}>
      <StepButton icon="remove" label={L.decrease(label)} onPress={() => step(field, -1)} />
      <Text style={s.stepLabel} numberOfLines={1}>
        {field === 'weight' ? `${STEP.weight} ${shown}` : label}
      </Text>
      <StepButton icon="add" label={L.increase(label)} onPress={() => step(field, 1)} />
    </View>
  );

  const showSteppers = active && !set.completed;
  return (
    <View style={[s.wrap, active && s.wrapActive]}>
      <View style={[s.row, set.completed && s.rowDone]}>
        <Pressable
          onPress={onActivate}
          onLongPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={L.setN(n)}
          accessibilityHint={L.deleteHint}
          style={s.num}
        >
          <Text style={[s.numText, set.set_type !== 'normal' && s.numTagged]} numberOfLines={1} adjustsFontSizeToFit>
            {label ?? index + 1}
          </Text>
        </Pressable>
        <Text style={s.last} numberOfLines={1}>
          {last || '—'}
        </Text>
        {input('weight', 'decimal-pad', L.weightLabel(n, shown), unit === 'bw' ? tr.units.bodyweight : '')}
        {input('reps', 'number-pad', L.repsLabel(n))}
        {showRpe ? input('rpe', 'decimal-pad', L.rpeLabel(n), '–') : null}
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ selected: set.completed }}
          accessibilityLabel={L.markDone(n)}
          style={[s.check, set.completed && s.checkDone, showSteppers && s.checkActive]}
        >
          <Ionicons name="checkmark" size={20} color={set.completed ? colors.lime : showSteppers ? colors.ink : '#B5B5AE'} />
        </Pressable>
      </View>
      {showSteppers ? (
        <>
          <View style={s.steppers}>
            {stepper('weight', L.weightLabel(n, shown))}
            {stepper('reps', L.reps)}
          </View>
          <View style={s.stepSizes} accessibilityRole="radiogroup" accessibilityLabel={L.stepSize}>
            <Text style={s.stepSizeLabel}>{L.stepSize}</Text>
            {steps.map((w) => {
              const on = w === weightStep;
              return (
                <Pressable
                  key={w}
                  onPress={() => pickStep(w)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={L.stepLabel(w, shown)}
                  hitSlop={4}
                  style={[s.stepChip, on && s.stepChipOn]}
                >
                  <Text style={[s.stepChipText, on && { color: colors.lime }]}>{w}</Text>
                </Pressable>
              );
            })}
            <Text style={s.stepSizeLabel}>{shown}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.stepButton, pressed && { backgroundColor: colors.lime }]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

/** Column headings; the weight column is a button that switches the exercise between kg, lb and bodyweight. */
export function SetHeader({ showRpe, unit, onUnitPress }: { showRpe: boolean; unit: WeightUnit; onUnitPress?: () => void }) {
  const L = useI18n().t.sets;
  return (
    <View style={[s.row, { paddingVertical: 0 }]}>
      <Text style={[s.head, { width: 26, textAlign: 'center' }]}>{L.set}</Text>
      <Text style={[s.head, { width: 56 }]}>{L.last}</Text>
      <Pressable
        onPress={onUnitPress}
        disabled={!onUnitPress}
        accessibilityRole="button"
        accessibilityLabel={L.switchUnit(unit === 'bw' ? L.bodyweight : unit)}
        hitSlop={8}
        style={s.flexCell}
      >
        <Text style={[s.head, s.unitChip, !!onUnitPress && s.unitChipOn]}>
          {unit === 'bw' ? L.bodyweight : unit}
          {onUnitPress ? ' ⇄' : ''}
        </Text>
      </Pressable>
      <Text style={[s.head, s.flexCell]}>{L.reps}</Text>
      {showRpe ? <Text style={[s.head, s.flexCell]}>{L.rpe}</Text> : null}
      <Text style={[s.head, { width: 44, textAlign: 'center' }]}>{L.done}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  wrapActive: { borderColor: colors.ink, backgroundColor: colors.card },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  rowDone: { backgroundColor: colors.limeSoft },
  num: { width: 26, height: 40, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  numTagged: { fontSize: 12, color: colors.warn },
  last: { width: 56, fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  head: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flexCell: { flex: 1, textAlign: 'center', alignItems: 'center' },
  unitChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  unitChipOn: { color: colors.ink, backgroundColor: colors.bg },
  input: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fonts.semibold,
    padding: 0,
  },
  inputDone: { backgroundColor: 'transparent', borderColor: 'transparent' },
  check: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.faint,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkActive: { backgroundColor: colors.lime, borderColor: colors.ink },
  steppers: { flexDirection: 'row', gap: 8, paddingHorizontal: 6, paddingBottom: 8, paddingTop: 2 },
  stepper: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: fonts.semibold, color: colors.muted },
  stepSizes: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 10 },
  stepSizeLabel: { fontSize: 12, fontFamily: fonts.semibold, color: colors.muted },
  stepChip: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  stepChipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
});
