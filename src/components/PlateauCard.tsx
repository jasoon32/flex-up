import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { getPlateauTip, savedPlateauTip, type Plateau } from '@/data/coach';
import { trName } from '@/data/names';
import { aiErrorText } from '@/lib/ai';
import { CoachNote, type CoachState } from '@/components/CoachNote';
import { Eyebrow, styles } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

/** Lifts with no new best for 3+ weeks; the coach's fix for each is asked for on tap. */
export function PlateauCard({ plateaus }: { plateaus: Plateau[] }) {
  const { t } = useI18n();
  const A = t.ai;
  if (plateaus.length === 0) return null;
  return (
    <View style={s.card}>
      <View style={{ gap: 2 }}>
        <Eyebrow>{A.stuckTitle}</Eyebrow>
        <Text style={styles.small}>{A.stuckSub}</Text>
      </View>
      {plateaus.slice(0, 3).map((p) => (
        <PlateauRow key={p.exercise.name} plateau={p} />
      ))}
    </View>
  );
}

function PlateauRow({ plateau }: { plateau: Plateau }) {
  const { t } = useI18n();
  const A = t.ai;
  const name = plateau.exercise.name;
  const saved = savedPlateauTip(name);
  const [tip, setTip] = useState<CoachState | null>(saved ? { kind: 'text', text: saved } : null);

  const ask = () => {
    setTip({ kind: 'loading' });
    getPlateauTip(plateau)
      .then((text) => setTip(text ? { kind: 'text', text } : { kind: 'error', message: A.failed }))
      .catch((e) => setTip({ kind: 'error', message: aiErrorText(e) }));
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.row, { gap: 10 }]}>
        <Pressable
          style={{ flex: 1, gap: 2 }}
          onPress={() => router.push({ pathname: '/exercise/[name]', params: { name } })}
          accessibilityRole="button"
        >
          <Text style={s.name} numberOfLines={1}>
            {trName(name)}
          </Text>
          <Text style={styles.small}>{A.stuckSince(plateau.weeks)}</Text>
        </Pressable>
        {!tip ? (
          <Pressable onPress={ask} accessibilityRole="button" style={s.tipBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} />
            <Text style={s.tipText}>{A.getTip}</Text>
          </Pressable>
        ) : null}
      </View>
      {tip ? <CoachNote compact state={tip} onRetry={ask} /> : null}
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
  name: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  tipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  tipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
});
