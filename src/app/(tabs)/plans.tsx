import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listPlans } from '@/data/plans';
import { useFocusData } from '@/hooks/useAsync';
import { useI18n, type Strings } from '@/i18n';
import { Button, EmptyState, ErrorBanner, Loading, styles } from '@/components/ui';
import { DayStrip } from '@/components/DayPicker';
import { colors, fonts, radius, space } from '@/theme';
import type { PlanWithExercises } from '@/lib/types';
import { trName } from '@/data/names';
import { openQuickWorkout } from '@/lib/quickWorkout';

function planMeta(p: PlanWithExercises, t: Strings): string {
  const sets = p.exercises.reduce((sum, e) => sum + e.target_sets, 0);
  return [t.plans.nExercises(p.exercises.length), p.days.length ? t.plans.nSets(sets) : t.plans.notScheduled].join(
    ' · ',
  );
}

export default function Plans() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useFocusData(listPlans);

  if (!data && loading) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        contentContainerStyle={[styles.content, { gap: 14 }]}
        data={data ?? []}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.muted} />}
        ListHeaderComponent={
          <View style={{ gap: space.lg }}>
            <View style={styles.between}>
              <Text style={styles.title}>{t.plans.title}</Text>
              <Button
                title={t.plans.newPlan}
                small
                pill
                icon={<Ionicons name="add" size={18} color={colors.lime} />}
                onPress={() => router.push('/plan/new')}
                style={{ minHeight: 44 }}
              />
            </View>
            <Text style={styles.muted}>{t.plans.intro}</Text>
            <View style={s.shortcuts}>
              <Shortcut
                icon="library-outline"
                title={t.programs.browse}
                hint={t.programs.browseHint}
                onPress={() => router.push('/programs')}
                dark
              />
              <Shortcut icon="flash-outline" title={t.quick.start} hint={t.quick.hint} onPress={openQuickWorkout} />
            </View>
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
          </View>
        }
        ListEmptyComponent={!error ? <EmptyState title={t.plans.emptyTitle} message={t.plans.emptyText} /> : undefined}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/plan/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${trName(item.name, 'plan')}, ${planMeta(item, t)}`}
            style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.name}>{trName(item.name, 'plan')}</Text>
                <Text style={styles.small}>{planMeta(item, t)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
            <DayStrip days={item.days} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function Shortcut({
  icon,
  title,
  hint,
  onPress,
  dark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
  dark?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => [s.shortcut, dark && s.shortcutDark, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={22} color={dark ? colors.lime : colors.ink} />
      <Text style={[s.shortcutTitle, dark && { color: colors.onInk }]}>{title}</Text>
      <Text style={[styles.small, dark && { color: colors.onInkMuted }]}>{hint}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
  },
  shortcutDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  shortcutTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  name: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
});
