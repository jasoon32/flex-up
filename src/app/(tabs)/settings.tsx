import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { REST_CHOICES, setPrefs, usePrefs } from '@/lib/prefs';
import { formatRest } from '@/lib/validation';
import { LANGUAGES, useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { Button, Eyebrow, styles } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { session } = useAuth();
  const prefs = usePrefs();

  const signOut = () =>
    Alert.alert(t.settings.signOutQ, undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.signOut,
        style: 'destructive',
        onPress: async () => {
          // Only this device: Supabase's default ('global') also signed out every other phone and browser.
          const { error } = await supabase.auth.signOut({ scope: 'local' });
          if (error) Alert.alert(t.settings.signOutFailed, errorMessage(error));
        },
      },
    ]);

  /** Deletes the account and everything in it (plans, workouts, sets), then signs out on this device. */
  const deleteAccount = () =>
    Alert.alert(t.settings.deleteAccountQ, t.settings.deleteAccountMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.deleteAccount,
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_my_account');
          if (error) return Alert.alert(t.settings.couldntDeleteAccount, errorMessage(error));
          // The account is gone on the server, so only the local session is left to clear.
          await supabase.auth.signOut({ scope: 'local' });
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { gap: space.xxl }]}>
        <Text style={styles.title}>{t.settings.title}</Text>

        <View style={{ gap: 10 }}>
          <Eyebrow>{t.settings.language}</Eyebrow>
          <View style={s.group}>
            {LANGUAGES.map((l, i) => {
              const on = l.id === lang;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setLang(l.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[s.option, i > 0 && s.divider]}
                >
                  <Text style={[s.optionText, on && { fontFamily: fonts.semibold }]}>{l.label}</Text>
                  <View style={[s.radio, on && s.radioOn]}>
                    {on ? <Ionicons name="checkmark" size={16} color={colors.lime} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>{t.settings.workout}</Eyebrow>
          <View style={s.group}>
            <View style={[s.block, { gap: space.md }]}>
              <View style={{ gap: 2 }}>
                <Text style={s.optionText}>{t.settings.defaultRest}</Text>
                <Text style={styles.small}>{t.settings.defaultRestHint}</Text>
              </View>
              <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel={t.settings.defaultRest}>
                {REST_CHOICES.map((sec) => {
                  const on = prefs.defaultRest === sec;
                  return (
                    <Pressable
                      key={sec}
                      onPress={() => setPrefs({ defaultRest: sec })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[s.chip, on && s.chipOn]}
                    >
                      <Text style={[s.chipText, on && { color: colors.onInk }]}>{formatRest(sec)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[s.option, s.divider, { gap: space.md }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.optionText}>{t.settings.showRpe}</Text>
                <Text style={styles.small}>{t.settings.showRpeHint}</Text>
              </View>
              <Switch
                value={prefs.showRpe}
                onValueChange={(v) => setPrefs({ showRpe: v })}
                trackColor={{ false: colors.field, true: colors.ink }}
                thumbColor={prefs.showRpe ? colors.lime : colors.card}
                accessibilityLabel={t.settings.showRpe}
              />
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>{t.settings.account}</Eyebrow>
          <View style={[s.group, { padding: space.lg, gap: space.md }]}>
            <View style={{ gap: 2 }}>
              <Text style={styles.small}>{t.settings.signedInAs}</Text>
              <Text style={styles.textMedium}>{session?.user.email ?? '—'}</Text>
            </View>
            <Button title={t.settings.signOut} variant="secondary" onPress={signOut} />
          </View>
          <Button title={t.settings.deleteAccount} variant="danger" onPress={deleteAccount} />
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>{t.settings.about}</Eyebrow>
          <Text style={styles.muted}>{t.settings.version}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  group: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  option: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  block: { padding: space.lg },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  optionText: { fontSize: 16, fontFamily: fonts.medium, color: colors.ink },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
