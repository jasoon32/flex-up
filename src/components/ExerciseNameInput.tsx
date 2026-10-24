import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PLAN_LIBRARY, suggestNames } from '@/data/exerciseLibrary';
import { nameIn, toSaved, type NameKind } from '@/data/names';
import { useI18n } from '@/i18n';
import { colors, fonts, radius } from '@/theme';

interface Props {
  /** The saved name (English for built-in names). */
  value: string;
  onChangeText: (text: string) => void;
  /** Exercise names (default) or workout/plan names such as Push, Upper, Chest. */
  kind?: NameKind;
  placeholder?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  style?: StyleProp<TextStyle>;
  /** More names to suggest, e.g. exercises already in the user's plans. */
  extraNames?: string[];
}

/** Workout splits offered before anything is typed in a plan name. */
const POPULAR_PLANS = PLAN_LIBRARY.slice(0, 8);

/**
 * Name field that suggests common gym exercises (or workout names) as you type ("pu" → Push-Up,
 * Pull-Up…). Built-in names show in the app's language and are saved in English, so they switch
 * language with the app; anything typed by hand is saved and shown exactly as typed.
 */
export function ExerciseNameInput({ value, onChangeText, kind = 'exercise', extraNames, style, ...inputProps }: Props) {
  const { lang } = useI18n();
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = nameIn(value, lang, kind);
  const suggestions = useMemo(() => {
    if (!focused) return [];
    if (kind === 'plan' && value.trim() === '') return POPULAR_PLANS;
    return suggestNames(shown, kind, lang, extraNames);
  }, [focused, kind, value, shown, lang, extraNames]);

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <TextInput
        {...inputProps}
        value={shown}
        onChangeText={(text) => onChangeText(toSaved(text, kind))}
        maxLength={60}
        autoCapitalize="words"
        autoCorrect={false}
        placeholderTextColor={colors.faint}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        // Delay hiding so a tap on a suggestion still lands (on web the input blurs first).
        onBlur={() => {
          blurTimer.current = setTimeout(() => setFocused(false), 200);
        }}
        style={style}
      />
      {suggestions.length > 0 ? (
        <View style={s.list} accessibilityRole="list">
          {suggestions.map((name, i) => (
            <Pressable
              key={name}
              onPress={() => {
                onChangeText(name);
                setFocused(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={nameIn(name, lang, kind)}
              style={({ pressed }) => [s.item, i > 0 && s.divider, pressed && { backgroundColor: colors.bg }]}
            >
              <Ionicons name={kind === 'plan' ? 'calendar-outline' : 'barbell-outline'} size={16} color={colors.muted} />
              <Text style={s.text} numberOfLines={1}>
                {nameIn(name, lang, kind)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  list: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  item: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});
