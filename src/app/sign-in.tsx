import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { validateEmail } from '@/lib/validation';
import { LANGUAGES, useI18n } from '@/i18n';
import { Button, TextField } from '@/components/ui';
import { PixelCharacter } from '@/components/PixelCharacter';
import { colors, fonts, radius } from '@/theme';

/** signIn / signUp, or the two steps of a password reset: ask for the email, then the emailed code. */
type Mode = 'signIn' | 'signUp' | 'resetEmail' | 'resetCode';

export default function SignIn() {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setCode('');
  };

  const run = async (task: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const checkEmail = () => {
    const err = validateEmail(email);
    if (err) setError(err);
    return !err;
  };

  const submit = () => {
    if (!checkEmail()) return;
    if (password.length < 6) return setError(t.auth.passwordTooShort);
    run(async () => {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // Navigation happens automatically when the session changes.
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          switchMode('signIn');
          setInfo(t.auth.accountCreated);
        }
      }
    });
  };

  const sendCode = () => {
    if (!checkEmail()) return;
    run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setMode('resetCode');
      setInfo(t.auth.codeSent(email.trim()));
    });
  };

  const setNewPassword = () => {
    // The reset email template shows {{ .Token }} (needs custom SMTP in Supabase; see README).
    const token = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return setError(t.auth.invalidCode);
    if (password.length < 6) return setError(t.auth.passwordTooShort);
    run(async () => {
      // Verifying the code signs the user in; then the new password is saved on that session.
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' });
      if (verifyError) throw verifyError;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert(t.auth.passwordUpdated, t.auth.passwordUpdatedMsg);
    });
  };

  const other = LANGUAGES.find((l) => l.id !== lang)!;
  const resetting = mode === 'resetEmail' || mode === 'resetCode';

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 20 }}>
            <View style={s.topRow}>
              <View style={s.art}>
                <PixelCharacter pixel={4} />
              </View>
              <Pressable
                onPress={() => setLang(other.id)}
                accessibilityRole="button"
                accessibilityLabel={other.label}
                style={s.langButton}
              >
                <Text style={s.langText}>{other.label}</Text>
              </Pressable>
            </View>
            <Text style={s.title}>{resetting ? t.auth.resetTitle : 'Flex Up'}</Text>
            <Text style={s.tagline}>{resetting ? t.auth.resetIntro : t.auth.tagline}</Text>
          </View>

          <View style={{ gap: 14 }}>
            <TextField
              dark
              label={t.auth.email}
              value={email}
              onChangeText={setEmail}
              editable={mode !== 'resetCode'}
              autoCapitalize="none"
              // Password managers (iCloud Keychain in Safari especially) look for the "username"
              // field next to a "current-password" one to recognise a sign-in form; "email" made
              // Safari offer a new strong password instead of the saved login.
              autoComplete="username"
              keyboardType="email-address"
              textContentType="username"
              nativeID="username"
              placeholder="you@example.com"
              style={mode === 'resetCode' ? { opacity: 0.6 } : undefined}
            />

            {mode === 'resetCode' ? (
              <TextField
                dark
                label={t.auth.code}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                placeholder="123456"
                style={{ fontSize: 22, letterSpacing: 6, fontFamily: fonts.semibold }}
              />
            ) : null}

            {mode !== 'resetEmail' ? (
              <TextField
                dark
                label={mode === 'resetCode' ? t.auth.newPassword : t.auth.password}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                nativeID={mode === 'signIn' ? 'current-password' : 'new-password'}
                placeholder={t.auth.passwordPlaceholder}
                onSubmitEditing={mode === 'resetCode' ? setNewPassword : submit}
              />
            ) : null}

            {error ? (
              <Text role="alert" style={[s.message, { color: '#FF8A7A' }]}>
                {error}
              </Text>
            ) : null}
            {info ? <Text style={[s.message, { color: colors.lime }]}>{info}</Text> : null}

            {mode === 'resetEmail' ? (
              <Button
                title={t.auth.sendCode}
                variant="lime"
                onPress={sendCode}
                loading={busy}
                style={{ marginTop: 6 }}
              />
            ) : mode === 'resetCode' ? (
              <Button
                title={t.auth.setPassword}
                variant="lime"
                onPress={setNewPassword}
                loading={busy}
                style={{ marginTop: 6 }}
              />
            ) : (
              <Button
                title={mode === 'signIn' ? t.auth.signIn : t.auth.createAccount}
                variant="lime"
                onPress={submit}
                loading={busy}
                style={{ marginTop: 6 }}
              />
            )}

            <View style={s.links}>
              {resetting ? (
                <>
                  <Link label={t.auth.backToSignIn} onPress={() => switchMode('signIn')} disabled={busy} />
                  {mode === 'resetCode' ? (
                    <Link label={t.auth.resendCode} onPress={sendCode} disabled={busy} muted />
                  ) : null}
                </>
              ) : (
                <>
                  <Link
                    label={mode === 'signIn' ? t.auth.createAccount : t.auth.haveAccount}
                    onPress={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                    disabled={busy}
                  />
                  {mode === 'signIn' ? (
                    <Link label={t.auth.forgot} onPress={() => switchMode('resetEmail')} disabled={busy} muted />
                  ) : null}
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Link({
  label,
  onPress,
  disabled,
  muted,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={s.link}>
      <Text style={[s.linkText, muted && { color: colors.onInkMuted, textDecorationLine: 'none' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 40,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  art: {
    width: 96,
    height: 116,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inkLine,
    justifyContent: 'center',
  },
  langText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onInk },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1, color: colors.onInk },
  tagline: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.onInkMuted },
  message: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onInk, textDecorationLine: 'underline' },
});
