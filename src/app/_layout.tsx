import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { RestTimerProvider } from '@/providers/RestTimerProvider';
import { I18nProvider, useI18n } from '@/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Loading, styles } from '@/components/ui';
import { AlertHost } from '@/components/AlertHost';
import { colors, fonts } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  // A font failure falls back to system fonts rather than blocking the app.
  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <I18nProvider>
      <StatusBar style="dark" />
      {isSupabaseConfigured ? (
        <AuthProvider>
          <RestTimerProvider>
            <RootNavigator />
          </RestTimerProvider>
        </AuthProvider>
      ) : (
        <MissingConfig />
      )}
      <AlertHost />
    </I18nProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 17 },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plan/[id]" options={{ title: t.editor.editTitle }} />
        <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="celebrate/[id]"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="share/[id]" options={{ title: t.share.title }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function MissingConfig() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Supabase is not configured</Text>
        <Text style={styles.text}>
          Create a file named .env.local in the project root with EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example and README.md), then restart with:
        </Text>
        <Text style={[styles.textMedium, { fontFamily: 'Menlo' }]}>npx expo start --clear</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
