import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n';
import { WEEK_ORDER } from '@/lib/days';
import { readPlanLink } from '@/lib/planLink';
import { formatTarget, savePlan } from '@/data/plans';
import { trName } from '@/data/names';
import { Button, EmptyState, styles } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

/** Opened from a shared plan link: shows the plan, and adds it to your plans on request. */
export default function ImportPlan() {
  const { t } = useI18n();
  const S = t.planShare;
  const { d } = useLocalSearchParams<{ d?: string }>();
  const plan = d ? readPlanLink(d) : null;
  const [busy, setBusy] = useState(false);

  if (!plan) {
    return (
      <View style={[styles.screen, { padding: space.xl }]}>
        <EmptyState title={S.importTitle} message={S.badLink} />
      </View>
    );
  }

  const add = async () => {
    setBusy(true);
    try {
      const id = await savePlan(null, plan);
      Alert.alert(S.imported);
      router.replace(`/plan/${id}`);
    } catch (e) {
      Alert.alert(t.editor.couldntSave, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const days = WEEK_ORDER.filter((x) => plan.days.includes(x)).map((x) => t.days.short[x]);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: space.lg }]}>
      <Text style={styles.muted}>{S.importIntro}</Text>
      <View style={s.card}>
        <Text style={s.name}>{trName(plan.name, 'plan')}</Text>
        {days.length ? <Text style={styles.small}>{days.join(' · ')}</Text> : null}
        {plan.exercises.map((e, i) => (
          <View key={`${e.name}-${i}`} style={[styles.between, { paddingVertical: 6 }, i > 0 && s.divider]}>
            <Text style={[styles.textMedium, { flex: 1 }]}>{trName(e.name)}</Text>
            <Text style={styles.small}>{formatTarget(e)}</Text>
          </View>
        ))}
      </View>
      <Button
        title={S.importAdd}
        icon={<Ionicons name="add" size={18} color={colors.lime} />}
        onPress={add}
        loading={busy}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
  },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
