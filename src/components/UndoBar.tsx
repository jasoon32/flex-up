import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { notifyDataChanged } from '@/lib/dataEvents';
import { TAB_BAR_HEIGHT, TAB_ROUTES } from '@/lib/tabs';
import { registerUndoHost, type UndoOffer } from '@/lib/undo';
import { colors, fonts, radius } from '@/theme';

/** How long the Undo button stays. */
const UNDO_MS = 8000;

/**
 * "Workout deleted · Undo" along the bottom for a few seconds after a delete, on whichever
 * screen the app goes to next. Undo puts the workout back and refreshes the lists.
 */
export function UndoBar() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      registerUndoHost((next) => {
        if (timer.current) clearTimeout(timer.current);
        setOffer(next);
        timer.current = setTimeout(() => setOffer(null), UNDO_MS);
      }),
    [],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!offer) return null;

  const undo = async () => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    try {
      await offer.undo();
      notifyDataChanged();
      setOffer(null);
    } catch (e) {
      setOffer(null);
      Alert.alert(t.undo.couldntRestore, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onTabs = TAB_ROUTES.includes(pathname);
  return (
    <View
      role="status"
      style={[s.bar, { bottom: insets.bottom + (onTabs ? TAB_BAR_HEIGHT + 8 : 12) }]}
      pointerEvents="box-none"
    >
      <Ionicons name="trash-outline" size={18} color={colors.onInkMuted} />
      <Text style={s.text} numberOfLines={2}>
        {offer.message}
      </Text>
      <Pressable
        onPress={undo}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t.undo.undo}
        hitSlop={8}
        style={({ pressed }) => [s.button, pressed && { opacity: 0.8 }]}
      >
        {busy ? <ActivityIndicator color={colors.ink} size="small" /> : <Text style={s.buttonText}>{t.undo.undo}</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.onInk },
  button: {
    height: 40,
    minWidth: 76,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
});
