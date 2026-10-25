import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The default 49pt bar leaves the 12pt label only ~10pt under the icon, cutting it in half.
        // Setting a height replaces the default, so the home-indicator inset is added back here.
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="plans" options={{ title: t.tabs.plans, tabBarIcon: icon('list-outline', 'list') }} />
      <Tabs.Screen
        name="progress"
        options={{ title: t.tabs.progress, tabBarIcon: icon('stats-chart-outline', 'stats-chart') }}
      />
      <Tabs.Screen name="history" options={{ title: t.tabs.history, tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen
        name="character"
        options={{ title: t.tabs.character, tabBarIcon: icon('happy-outline', 'happy') }}
      />
      {/* Five tabs fit a phone; Settings opens from the gear on Character and the account button on Home. */}
      <Tabs.Screen name="settings" options={{ title: t.tabs.settings, href: null }} />
    </Tabs>
  );
}
