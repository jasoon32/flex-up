import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n';
import { bodyWeightKg, deleteBodyWeight, logBodyWeight, type BodyWeight } from '@/data/bodyweight';
import { dayKey } from '@/data/progress';
import { shortDate, signed } from '@/lib/format';
import { LineChart } from './LineChart';
import { Button, Eyebrow, styles } from './ui';
import { colors, fonts, radius, space } from '@/theme';

/** Latest weight, its trend, and a quick way to log today's. */
export function BodyWeightCard({ weights, onChanged }: { weights: BodyWeight[]; onChanged: () => void }) {
  const { t } = useI18n();
  const P = t.progress;
  const latest = weights[weights.length - 1];
  const [unit, setUnit] = useState<'kg' | 'lb'>(latest?.unit ?? 'kg');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const value = Number(text.replace(',', '.'));
    const kg = unit === 'lb' ? bodyWeightKg({ weight: value, unit: 'lb' }) : value;
    if (!text.trim() || !Number.isFinite(value) || kg < 20 || kg > 400) return setError(P.weightRange);
    setBusy(true);
    try {
      await logBodyWeight(Math.round(value * 10) / 10, unit, dayKey(new Date()));
      setText('');
      setOpen(false);
      setError(null);
      onChanged();
    } catch (e) {
      Alert.alert(P.couldntSaveWeight, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (w: BodyWeight) =>
    Alert.alert(P.deleteWeightQ, `${w.weight} ${w.unit} · ${shortDate(new Date(`${w.logged_on}T00:00:00`))}`, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBodyWeight(w.id);
            onChanged();
          } catch (e) {
            Alert.alert(P.couldntSaveWeight, errorMessage(e));
          }
        },
      },
    ]);

  // Shown in the unit of the latest entry, whichever unit older entries were logged in.
  const shownUnit = latest?.unit ?? 'kg';
  const inUnit = (w: BodyWeight) => (shownUnit === 'lb' ? bodyWeightKg(w) / 0.45359237 : bodyWeightKg(w));
  const first = weights[0];
  const diff = latest && first && latest !== first ? signed(inUnit(latest) - inUnit(first), 1) : '';

  return (
    <View style={s.card}>
      <View style={styles.between}>
        <Eyebrow>{P.bodyWeight}</Eyebrow>
        {!open ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8} style={s.logBtn}>
            <Ionicons name="add" size={16} color={colors.lime} />
            <Text style={s.logText}>{P.logWeight}</Text>
          </Pressable>
        ) : null}
      </View>

      {latest ? (
        <>
          <View style={{ gap: 2 }}>
            <Text style={s.big}>
              {latest.weight} {latest.unit}
            </Text>
            {diff ? (
              <Text style={styles.small}>{P.changeSince(`${diff} ${shownUnit}`, shortDate(new Date(`${first.logged_on}T00:00:00`)))}</Text>
            ) : null}
          </View>
          {weights.length > 1 ? (
            <LineChart
              points={weights.map((w) => ({ t: new Date(`${w.logged_on}T12:00:00`).getTime(), v: Math.round(inUnit(w) * 10) / 10 }))}
              format={(v) => `${v} ${shownUnit}`}
              height={120}
              label={t.exercise.chartLabel(P.bodyWeight)}
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.muted}>{P.noWeight}</Text>
      )}

      {open ? (
        <View style={{ gap: 8 }}>
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                setError(null);
              }}
              placeholder={P.weightPlaceholder}
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              autoFocus
              onSubmitEditing={save}
              accessibilityLabel={P.weightToday}
              style={[styles.input, { flex: 1 }]}
            />
            <View style={s.segment} accessibilityRole="radiogroup">
              {(['kg', 'lb'] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: unit === u }}
                  style={[s.seg, unit === u && s.segOn]}
                >
                  <Text style={[s.segText, unit === u && { color: colors.lime }]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {error ? (
            <Text role="alert" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Button title={t.common.cancel} variant="secondary" small style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <Button title={t.common.save} small style={{ flex: 1 }} onPress={save} loading={busy} />
          </View>
        </View>
      ) : null}

      {weights.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.label}>{P.recentWeights}</Text>
          {weights
            .slice(-4)
            .reverse()
            .map((w) => (
              <Pressable
                key={w.id}
                onLongPress={() => remove(w)}
                accessibilityHint={P.deleteWeightQ}
                style={[styles.between, { paddingVertical: 4 }]}
              >
                <Text style={styles.small}>{shortDate(new Date(`${w.logged_on}T00:00:00`))}</Text>
                <View style={[styles.row, { gap: 10 }]}>
                  <Text style={styles.textMedium}>
                    {w.weight} {w.unit}
                  </Text>
                  <Pressable onPress={() => remove(w)} accessibilityRole="button" accessibilityLabel={t.common.delete} hitSlop={8}>
                    <Ionicons name="close" size={16} color={colors.faint} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  big: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  logText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onInk },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 3, gap: 2 },
  seg: { minWidth: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
});
