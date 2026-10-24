import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { registerAlertHost, type WebDialog } from '@/lib/alert';
import { colors, fonts, radius, space } from '@/theme';

/**
 * Web only: shows Alert.alert dialogs inside the app with all their buttons (Cancel, Resume,
 * Start anyway…), the way the phone does, instead of the browser's two-button confirm().
 */
export function AlertHost() {
  const [queue, setQueue] = useState<WebDialog[]>([]);
  useEffect(() => registerAlertHost((d) => setQueue((q) => [...q, d])), []);

  if (Platform.OS !== 'web' || queue.length === 0) return null;
  const dialog = queue[0];
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');

  const press = (onPress?: AlertButton['onPress']) => {
    setQueue((q) => q.slice(1));
    (onPress as (() => void) | undefined)?.();
  };
  // Like the phone, the cancel button sits on the left; the others keep their order.
  const ordered = [...dialog.buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'));
  const stacked = ordered.length > 2;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => press(cancel?.onPress)}>
      <Pressable style={s.backdrop} onPress={cancel ? () => press(cancel.onPress) : undefined} accessibilityRole="none">
        <Pressable style={s.card} accessibilityRole="alert" onPress={() => {}}>
          <Text style={s.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={s.message}>{dialog.message}</Text> : null}
          <View style={[s.buttons, stacked && s.stacked]}>
            {ordered.map((b, i) => {
              // The last choice is the main one (dark), unless it's a cancel or a destructive one.
              const primary = i === ordered.length - 1 && b.style !== 'cancel' && b.style !== 'destructive';
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => press(b.onPress)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    s.button,
                    !stacked && { flex: 1 },
                    primary && s.primary,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      s.buttonText,
                      primary && { color: colors.onInk },
                      b.style === 'destructive' && { color: colors.danger },
                      b.style === 'cancel' && { fontFamily: fonts.medium },
                    ]}
                  >
                    {b.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
  },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  stacked: { flexDirection: 'column-reverse' },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  primary: { backgroundColor: colors.ink },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textAlign: 'center' },
});
