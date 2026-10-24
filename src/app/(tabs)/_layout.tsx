import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useI18n } from '@/i18n';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="plans" options={{ title: t.tabs.plans, tabBarIcon: icon('list-outline', 'list') }} />
      <Tabs.Screen name="history" options={{ title: t.tabs.history, tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen
        name="character"
        options={{ title: t.tabs.character, tabBarIcon: icon('happy-outline', 'happy') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t.tabs.settings, tabBarIcon: icon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
