import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { countCompletedSessions, listHistory } from '@/data/sessions';
import { useFocusData } from '@/hooks/useAsync';
import { locale, useI18n } from '@/i18n';
import { formatDuration, startOfWeek } from '@/lib/days';
import { Badge, Button, EmptyState, ErrorBanner, Loading, styles } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';
import { trName } from '@/data/names';

export default function History() {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const { data, error, loading, reload } = useFocusData(async () => {
    const [items, thisWeek, total] = await Promise.all([
      listHistory(),
      countCompletedSessions(startOfWeek()),
      countCompletedSessions(),
    ]);
    return { items, thisWeek, total };
  });

  if (!data && loading) return <Loading />;

  // The newest session starts expanded until the user toggles something.
  const expandedId = openId === undefined ? data?.items[0]?.id : openId;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        contentContainerStyle={[styles.content, { gap: 14 }]}
        data={data?.items ?? []}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.muted} />}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={styles.title}>{t.history.title}</Text>
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {/* Without loaded counts (e.g. no signal) the tiles would claim "0 workouts". */}
            {data ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[s.stat, s.statDark]}>
                  <Text style={[s.statLabel, { color: colors.onInkMuted }]}>{t.history.thisWeek}</Text>
                  <Text style={[s.statValue, { color: colors.onInk }]}>{t.history.nWorkouts(data.thisWeek)}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statLabel}>{t.history.total}</Text>
                  <Text style={s.statValue}>{t.history.nWorkouts(data.total)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !error ? <EmptyState title={t.history.emptyTitle} message={t.history.emptyText} /> : undefined
        }
        renderItem={({ item }) => {
          const open = expandedId === item.id;
          const date = new Date(item.started_at);
          const meta = item.completed_at
            ? t.history.doneMeta(formatDuration(item.started_at, item.completed_at), item.completedSets)
            : t.history.inProgressMeta(item.completedSets, item.totalSets);
          return (
            <View style={s.card}>
              <Pressable
                onPress={() => setOpenId(open ? null : item.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={s.header}
              >
                <View style={s.dateTile}>
                  <Text style={s.dow}>{t.days.short[date.getDay()].toUpperCase()}</Text>
                  <Text style={s.dayNum}>{date.getDate()}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    <Text style={s.name}>{trName(item.plan_name, 'plan')}</Text>
                    {item.completed_at ? (
                      <Badge label={t.badge.completed} tone="done" />
                    ) : (
                      <Badge label={t.badge.inProgress} tone="progress" />
                    )}
                  </View>
                  <Text style={styles.small} accessibilityLabel={`${date.toLocaleDateString(locale())}, ${meta}`}>
                    {meta}
                  </Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {open ? (
                <View style={s.body}>
                  {item.exercises.length === 0 ? (
                    <Text style={styles.small}>{t.history.noCompletedSets}</Text>
                  ) : (
                    item.exercises.map((ex) => (
                      <View key={ex.name} style={{ gap: 4 }}>
                        <Text style={s.exName}>{trName(ex.name)}</Text>
                        <Text style={[styles.small, { lineHeight: 20 }]}>{ex.summary}</Text>
                      </View>
                    ))
                  )}
                  <View style={styles.row}>
                    <Button
                      title={item.completed_at ? t.history.editSession : t.home.resumeWorkout}
                      variant="secondary"
                      small
                      onPress={() => router.push(`/workout/${item.id}`)}
                    />
                    {item.completed_at ? (
                      <Button
                        title={t.share.share}
                        small
                        icon={<Ionicons name="share-outline" size={16} color={colors.lime} />}
                        onPress={() => router.push(`/share/${item.id}`)}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    padding: 14,
    gap: 4,
  },
  statDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  statLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
  statValue: { fontSize: 22, fontFamily: fonts.display, color: colors.ink },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  dateTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dow: { fontSize: 10, fontFamily: fonts.semibold, color: colors.muted },
  dayNum: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
  },
  exName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
});
