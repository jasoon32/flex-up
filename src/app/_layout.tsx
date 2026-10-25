import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
    <WebSafeArea>
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
    </WebSafeArea>
  );
}

/**
 * On web, Expo Router hands every screen zero safe-area insets, so the tab bar and bottom
 * buttons sat under the iPhone home indicator. The library's own provider measures the real
 * insets (CSS env()) and keeps them updated on rotation. Native already has real insets.
 */
function WebSafeArea({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <SafeAreaProvider style={{ flex: 1 }}>{children}</SafeAreaProvider>;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;

  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 17 },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
        // Opened directly (a web refresh, or iOS reloading the home-screen app on this page)
        // there's no back arrow and no browser to go back with, so offer a way Home instead.
        headerLeft: navigation.canGoBack() ? undefined : () => <HomeBack label={t.tabs.home} />,
      })}
    >
      <Stack.Protected guard={!!session}>
        {/* The title is what back buttons name this screen (otherwise "(tabs), back"). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.tabs.home }} />
        <Stack.Screen name="plan/[id]" options={{ title: t.editor.editTitle }} />
        <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="celebrate/[id]"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="share/[id]" options={{ title: t.share.title }} />
        {/* The exercise screen sets its own title (the exercise's name). */}
        <Stack.Screen name="exercise/[name]" options={{ title: '' }} />
        <Stack.Screen name="programs" options={{ title: t.programs.title }} />
        <Stack.Screen name="import-plan" options={{ title: t.planShare.importTitle }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function HomeBack({ label }: { label: string }) {
  return (
    <Pressable
      onPress={() => router.replace('/')}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
    >
      <Ionicons name="chevron-back" size={24} color={colors.ink} />
    </Pressable>
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
