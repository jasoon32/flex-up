import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { strings } from '@/i18n';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'lime' | 'secondary' | 'white' | 'dashed' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  small,
  pill,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  pill?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const v = buttonVariants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        pill && { borderRadius: radius.pill },
        { backgroundColor: v.bg, borderColor: v.border, borderStyle: variant === 'dashed' ? 'dashed' : 'solid' },
        variant === 'dashed' && { borderWidth: 1.5 },
        pressed && { opacity: 0.75 },
        inactive && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: v.text }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.ink, text: colors.onInk, border: colors.ink },
  lime: { bg: colors.lime, text: colors.ink, border: colors.lime },
  secondary: { bg: colors.bg, text: colors.ink, border: colors.bg },
  white: { bg: colors.card, text: colors.ink, border: colors.border },
  dashed: { bg: 'transparent', text: colors.ink, border: colors.faint },
  danger: { bg: 'transparent', text: colors.danger, border: 'transparent' },
  ghost: { bg: 'transparent', text: colors.ink, border: 'transparent' },
};

export function TextField({
  label,
  error,
  dark,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; dark?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.label, dark && { color: colors.onInkMuted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={dark ? '#8A8A84' : colors.faint}
        style={[styles.input, dark && styles.inputDark, !!error && { borderColor: colors.danger }, style]}
        {...props}
      />
      {error ? (
        <Text role="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={[styles.errorText, { flex: 1 }]}>{message}</Text>
      {onRetry ? <Button title={strings().common.retry} variant="ghost" small onPress={onRetry} /> : null}
    </View>
  );
}

export function Loading({ dark }: { dark?: boolean }) {
  return (
    <View style={[styles.center, dark && { backgroundColor: colors.ink }]}>
      <ActivityIndicator color={dark ? colors.lime : colors.ink} size="large" />
    </View>
  );
}

export function EmptyState({ title, message, children }: { title: string; message?: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.h2}>{title}</Text>
      {message ? <Text style={[styles.muted, { textAlign: 'center' }]}>{message}</Text> : null}
      {children}
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'done' | 'progress' | 'muted' }) {
  const map = {
    done: { bg: colors.lime, fg: colors.ink },
    progress: { bg: colors.warnSoft, fg: colors.warn },
    muted: { bg: colors.bg, fg: colors.muted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

/** Small uppercase label above a section ("TODAY'S WORKOUT"). */
export function Eyebrow({ children, color = colors.muted }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: 48, gap: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    gap: space.lg,
  },
  button: {
    minHeight: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontFamily: fonts.semibold },
  buttonTextSmall: { fontSize: 14 },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  input: {
    height: 52,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.field,
    paddingHorizontal: space.lg,
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  inputDark: { backgroundColor: colors.inkField, borderColor: colors.inkLine, color: colors.onInk },
  errorText: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  title: { color: colors.text, fontSize: 28, fontFamily: fonts.display, letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 18, fontFamily: fonts.display },
  text: { color: colors.text, fontSize: 15, fontFamily: fonts.regular },
  textMedium: { color: colors.text, fontSize: 15, fontFamily: fonts.medium },
  muted: { color: colors.muted, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 13, fontFamily: fonts.regular },
  badge: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontFamily: fonts.bold },
  eyebrow: { fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
