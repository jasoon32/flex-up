import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusData } from '@/hooks/useAsync';
import { locale, useI18n } from '@/i18n';
import { buildExercises, loadHistory, type ExerciseHistory } from '@/data/progress';
import { bodyWeightKg, listBodyWeights } from '@/data/bodyweight';
import { getExerciseNotes } from '@/data/notes';
import { formatSet } from '@/data/sessions';
import { trName } from '@/data/names';
import { readLook } from '@/lib/character';
import { LB_TO_KG } from '@/lib/units';
import { formatKg, formatVolume } from '@/lib/format';
import { hasStandard, strengthRank, STRENGTH_LEVELS } from '@/lib/strength';
import { useAuth } from '@/providers/AuthProvider';
import { LineChart } from '@/components/LineChart';
import { EmptyState, ErrorBanner, Eyebrow, Loading, styles } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

type ChartKind = 'e1rm' | 'top' | 'volume' | 'reps';

const REP_COUNTS = [1, 2, 3, 5, 8, 10, 12, 15];

export default function ExerciseScreen() {
  const { t } = useI18n();
  const E = t.exercise;
  const { name } = useLocalSearchParams<{ name: string }>();
  const { session } = useAuth();
  const gender = readLook(session?.user).gender;
  const { data, error, loading, reload } = useFocusData(async () => {
    const [{ sessions, sets }, weights, notes] = await Promise.all([
      loadHistory(),
      listBodyWeights().catch(() => []),
      getExerciseNotes([name]).catch(() => new Map<string, string>()),
    ]);
    const mine = sets.filter((s) => s.exercise_name === name);
    const history = buildExercises(sessions, mine)[0] ?? null;
    const latestWeight = weights[weights.length - 1];
    return { history, bodyKg: latestWeight ? bodyWeightKg(latestWeight) : null, note: notes.get(name) ?? null };
  });
  const [chart, setChart] = useState<ChartKind | null>(null);

  const title = trName(name ?? '');
  const header = <Stack.Screen options={{ title }} />;
  if (!data && loading) return <Loading />;
  if (!data) {
    return (
      <View style={[styles.screen, { padding: space.xl }]}>
        {header}
        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      </View>
    );
  }
  const h = data.history;
  if (!h) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState title={title} message={E.notFound} />
      </View>
    );
  }

  const weighted = h.bestKg > 0;
  const kinds: ChartKind[] = weighted ? (h.bestE1rmKg ? ['e1rm', 'top', 'volume'] : ['top', 'volume']) : ['reps', 'volume'];
  const kind = chart && kinds.includes(chart) ? chart : kinds[0];
  const unit = h.unit;
  const shown = (kg: number) => (unit === 'lb' ? Math.round((kg / LB_TO_KG) * 10) / 10 : Math.round(kg * 10) / 10);
  const points = h.entries
    .map((e) => {
      const v =
        kind === 'e1rm' ? e.e1rmKg : kind === 'top' ? e.topKg : kind === 'volume' ? e.volumeKg : e.topReps || null;
      return v ? { t: e.date.getTime(), v: kind === 'volume' || kind === 'reps' ? Math.round(v) : shown(v) } : null;
    })
    .filter((x): x is { t: number; v: number } => x !== null);
  const fmt = (v: number) =>
    kind === 'volume'
      ? formatVolume(v)
      : kind === 'reps'
        ? E.reps(v)
        : `${v.toLocaleString(locale())} ${unit === 'lb' ? 'lb' : 'kg'}`;
  const bestVolume = Math.max(...h.entries.map((e) => e.volumeKg));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { gap: space.xl, paddingTop: space.lg }]}>
      {header}
      <View style={s.grid}>
        {weighted ? <Tile label={E.heaviest} value={formatKg(h.bestKg, unit)} /> : <Tile label={E.mostReps} value={E.reps(h.bestReps)} />}
        {h.bestE1rmKg ? <Tile label={E.e1rm} value={formatKg(h.bestE1rmKg, unit === 'lb' ? 'lb' : 'kg')} dark /> : null}
        <Tile label={E.workouts} value={String(h.entries.length)} />
        {bestVolume > 0 ? <Tile label={E.bestVolume} value={formatVolume(bestVolume)} /> : null}
      </View>

      {data.note ? (
        <View style={s.note}>
          <Text style={s.noteLabel}>{E.note}</Text>
          <Text style={styles.text}>{data.note}</Text>
        </View>
      ) : null}

      <View style={s.card}>
        <View style={s.segment} accessibilityRole="tablist">
          {kinds.map((k) => (
            <Pressable
              key={k}
              onPress={() => setChart(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: k === kind }}
              style={[s.seg, k === kind && s.segOn]}
            >
              <Text style={[s.segText, k === kind && { color: colors.lime }]}>{E.charts[k]}</Text>
            </Pressable>
          ))}
        </View>
        <LineChart points={points} format={fmt} label={E.chartLabel(E.charts[kind])} />
        {kind === 'e1rm' ? <Text style={styles.small}>{E.e1rmHint}</Text> : null}
      </View>

      {hasStandard(h.name) && h.bestE1rmKg ? (
        <StrengthCard history={h} bodyKg={data.bodyKg} gender={gender} />
      ) : null}

      {weighted && h.repBests.size > 0 ? (
        <View style={s.card}>
          <Eyebrow>{E.repRecords}</Eyebrow>
          {REP_COUNTS.filter((n) => h.repBests.has(n)).map((n, i) => (
            <View key={n} style={[styles.between, s.line, i > 0 && s.divider]}>
              <Text style={styles.textMedium}>{E.reps(n)}</Text>
              <Text style={s.lineValue}>{formatKg(h.repBests.get(n)!, unit)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Eyebrow>{E.history}</Eyebrow>
        <View style={s.list}>
          {[...h.entries].reverse().map((e, i) => (
            <Pressable
              key={e.sessionId}
              onPress={() => router.push(`/workout/${e.sessionId}`)}
              accessibilityRole="button"
              style={[s.histRow, i > 0 && s.divider]}
            >
              <View style={s.dateTile}>
                <Text style={s.dow}>{t.days.short[e.date.getDay()]}</Text>
                <Text style={s.dayNum}>{e.date.getDate()}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.small}>
                  {e.date.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })}
                  {e.record ? '  🏆' : ''}
                </Text>
                <Text style={styles.textMedium}>{e.sets.map((x) => formatSet({ ...x, rpe: null }, unit)).join(' · ')}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Tile({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <View style={[s.tile, dark && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      <Text style={[s.tileLabel, dark && { color: colors.onInkMuted }]}>{label}</Text>
      <Text style={[s.tileValue, dark && { color: colors.lime }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function StrengthCard({
  history,
  bodyKg,
  gender,
}: {
  history: ExerciseHistory;
  bodyKg: number | null;
  gender: 'M' | 'F';
}) {
  const { t } = useI18n();
  const E = t.exercise;
  if (!bodyKg) {
    return (
      <View style={s.card}>
        <Eyebrow>{E.strength}</Eyebrow>
        <Text style={styles.muted}>{E.needWeight}</Text>
      </View>
    );
  }
  const rank = strengthRank(history.name, history.bestE1rmKg!, bodyKg, gender);
  if (!rank) return null;
  const idx = STRENGTH_LEVELS.indexOf(rank.level);
  const next = STRENGTH_LEVELS[idx + 1];
  return (
    <View style={s.card}>
      <Eyebrow>{E.strength}</Eyebrow>
      <View style={styles.between}>
        <Text style={s.rank}>{E.levels[rank.level]}</Text>
        <Text style={styles.small}>{E.ratio((Math.round(rank.ratio * 100) / 100).toLocaleString(locale()))}</Text>
      </View>
      <View style={s.ladder}>
        {STRENGTH_LEVELS.map((l, i) => (
          <View key={l} style={[s.rung, i < idx && s.rungDone, i === idx && s.rungNow]}>
            {i === idx && rank.nextAt ? (
              <View style={[s.rungFill, { width: `${Math.round(rank.progress * 100)}%` }]} />
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.between}>
        {STRENGTH_LEVELS.map((l, i) => (
          <Text key={l} style={[s.rungLabel, i === idx && { color: colors.ink, fontFamily: fonts.bold }]}>
            {E.levels[l]}
          </Text>
        ))}
      </View>
      <Text style={styles.small}>
        {rank.nextAt && next ? E.nextLevel(E.levels[next], (Math.round(rank.nextAt * 2) / 2).toLocaleString(locale())) : E.topLevel}
      </Text>
      <Text style={[styles.small, { color: colors.faint }]}>{E.strengthHint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 4,
  },
  tileLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tileValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  note: { backgroundColor: colors.warnSoft, borderRadius: radius.md, padding: space.md, gap: 4 },
  noteLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.warn },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 3, gap: 2 },
  seg: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  rank: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  ladder: { flexDirection: 'row', gap: 4 },
  rung: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' },
  rungDone: { backgroundColor: colors.ink },
  rungNow: { backgroundColor: colors.limeSoft, borderWidth: 1, borderColor: colors.ink },
  rungFill: { height: '100%', backgroundColor: colors.lime },
  rungLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 10, color: colors.faint },
  line: { paddingVertical: 8 },
  lineValue: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  list: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
  },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
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
});
