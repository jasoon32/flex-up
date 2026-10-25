import { useState } from 'react';
import { useFocusData } from '@/hooks/useAsync';
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { User } from '@supabase/supabase-js';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n';
import { readLook } from '@/lib/character';
import { formatVolume } from '@/lib/format';
import { addFriend, friendsThisWeek, myFriendCode, removeFriend, type FriendRow } from '@/data/friends';
import { APP_URL } from '@/lib/planLink';
import { PixelCharacter } from './PixelCharacter';
import { Button, ErrorBanner, Eyebrow, styles } from './ui';
import { colors, fonts, radius, space } from '@/theme';

const CODE = /^[A-Z2-9]{6}$/;

/** This week's leaderboard with friends, your code to share, and a box to add a friend's. */
export function FriendsCard() {
  const { t } = useI18n();
  const F = t.friends;
  const { data, error, reload: load } = useFocusData(async () => {
    const [rows, code] = await Promise.all([friendsThisWeek(), myFriendCode()]);
    return { rows, code };
  });
  const rows = data?.rows ?? null;
  const code = data?.code ?? null;
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const add = async () => {
    const c = input.trim().toUpperCase();
    if (!CODE.test(c)) return setInputError(F.badCode);
    setAdding(true);
    try {
      await addFriend(c);
      setInput('');
      setInputError(null);
      await load();
      Alert.alert(F.added);
    } catch (e) {
      setInputError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert(F.copied, F.copiedMsg);
  };

  const invite = async () => {
    if (!code) return;
    const message = F.invite(code, APP_URL);
    try {
      if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && 'share' in navigator)) {
        await Clipboard.setStringAsync(message);
        Alert.alert(F.copied, F.copiedMsg);
        return;
      }
      await Share.share({ message });
    } catch {
      // Closing the share sheet isn't an error worth showing.
    }
  };

  const remove = (row: FriendRow) =>
    Alert.alert(F.removeQ(row.name || t.character.defaultName), F.removeMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: F.remove,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(row.user_id);
            load();
          } catch (e) {
            Alert.alert(F.couldntLoad, errorMessage(e));
          }
        },
      },
    ]);

  return (
    <View style={s.card}>
      <View style={{ gap: 4 }}>
        <Eyebrow>{F.title}</Eyebrow>
        <Text style={styles.small}>{F.intro}</Text>
      </View>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {rows?.map((row, i) => (
        <Pressable
          key={row.user_id}
          onLongPress={row.is_me ? undefined : () => remove(row)}
          accessibilityHint={row.is_me ? undefined : F.remove}
          style={[s.row, row.is_me && s.rowMe]}
        >
          <Text style={[s.rank, i === 0 && rows.length > 1 && { color: colors.ink }]}>{i + 1}</Text>
          <View style={s.art}>
            <PixelCharacter
              pixel={2}
              look={readLook({ user_metadata: { character: row.look ?? {} } } as unknown as User)}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={s.name} numberOfLines={1}>
              {row.is_me ? F.you(row.name || t.character.defaultName) : row.name || t.character.defaultName}
            </Text>
            <Text style={styles.small}>{F.meta(row.workouts, row.sets)}</Text>
          </View>
          <Text style={s.volume}>{formatVolume(row.volume)}</Text>
          {!row.is_me ? (
            <Pressable onPress={() => remove(row)} accessibilityRole="button" accessibilityLabel={F.remove} hitSlop={8}>
              <Text style={s.more}>···</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}

      <View style={s.codeBox}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>{F.yourCode}</Text>
          <Text style={s.code} selectable>
            {code ?? '······'}
          </Text>
        </View>
        <Button title={F.copy} variant="white" small onPress={copy} disabled={!code} />
        <Button title={F.share} small onPress={invite} disabled={!code} />
      </View>

      <View style={{ gap: 6 }}>
        <View style={[styles.row, { gap: 8 }]}>
          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setInputError(null);
            }}
            placeholder={F.codePlaceholder}
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={add}
            accessibilityLabel={F.codePlaceholder}
            style={[styles.input, s.codeInput, !!inputError && { borderColor: colors.danger }]}
          />
          <Button title={F.add} small onPress={add} loading={adding} style={{ minHeight: 52 }} />
        </View>
        {inputError ? (
          <Text role="alert" style={styles.errorText}>
            {inputError}
          </Text>
        ) : null}
      </View>
      <Text style={styles.small}>{F.privacy}</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowMe: { backgroundColor: colors.limeSoft },
  rank: { width: 18, textAlign: 'center', fontFamily: fonts.display, fontSize: 16, color: colors.faint },
  art: {
    width: 44,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  volume: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  more: { fontFamily: fonts.bold, fontSize: 16, color: colors.faint, paddingHorizontal: 4 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  code: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 3, color: colors.ink },
  codeInput: { flex: 1, letterSpacing: 3, fontFamily: fonts.display, textTransform: 'uppercase' },
});
