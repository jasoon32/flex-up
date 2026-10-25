import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n';
import { WEEK_ORDER } from '@/lib/days';
import { addProgram, PROGRAMS, type Program } from '@/data/programs';
import { formatTarget } from '@/data/plans';
import { trName } from '@/data/names';
import { Badge, Button, styles } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

/** Ready-made programs: read what's in each, then add its plans in one tap. */
export default function Programs() {
  const { t } = useI18n();
  const P = t.programs;
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const add = (program: Program) => {
    const name = P.list[program.id].name;
    Alert.alert(P.addQ(name), P.addMsg(program.plans.length), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: P.add,
        onPress: async () => {
          setAdding(program.id);
          try {
            await addProgram(program);
            Alert.alert(P.added, P.addedMsg);
            router.replace('/plans');
          } catch (e) {
            Alert.alert(P.couldntAdd, errorMessage(e));
          } finally {
            setAdding(null);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: space.lg, gap: 14 }]}>
      <Text style={styles.muted}>{P.intro}</Text>
      {PROGRAMS.map((program) => {
        const info = P.list[program.id];
        const expanded = open === program.id;
        return (
          <View key={program.id} style={s.card}>
            <Pressable
              onPress={() => setOpen(expanded ? null : program.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{ gap: 8 }}
            >
              <View style={styles.between}>
                <Text style={s.name}>{info.name}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </View>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                <Badge label={P.perWeek(program.perWeek)} tone="muted" />
                <Badge label={P.levels[program.level]} tone={program.level === 'beginner' ? 'done' : 'progress'} />
              </View>
              <Text style={styles.muted}>{info.summary}</Text>
            </Pressable>
            {expanded ? (
              <View style={{ gap: space.md }}>
                {program.plans.map((plan) => (
                  <View key={plan.name} style={s.plan}>
                    <View style={styles.between}>
                      <Text style={s.planName}>{trName(plan.name, 'plan')}</Text>
                      <Text style={styles.small}>
                        {WEEK_ORDER.filter((d) => plan.days.includes(d))
                          .map((d) => t.days.short[d])
                          .join(' · ')}
                      </Text>
                    </View>
                    {plan.exercises.map(([name, sets, min, max]) => (
                      <View key={name} style={[styles.between, { paddingVertical: 3 }]}>
                        <Text style={[styles.text, { flex: 1 }]}>{trName(name)}</Text>
                        <Text style={styles.small}>
                          {formatTarget({ target_sets: sets, target_reps: min, target_reps_max: max })}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
                <Button
                  title={P.add}
                  icon={<Ionicons name="add" size={18} color={colors.lime} />}
                  onPress={() => add(program)}
                  loading={adding === program.id}
                  disabled={adding !== null}
                />
              </View>
            ) : null}
          </View>
        );
      })}
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
    gap: space.md,
  },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, flexShrink: 1 },
  plan: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, gap: 4 },
  planName: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
