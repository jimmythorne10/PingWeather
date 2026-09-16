import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../src/stores/themeStore';

export default function TabLayout() {
  // `tokens` now holds STRUCTURE; colour moved to `colors` when the look axis
  // landed. Aliased rather than renamed so the JSX below stays untouched.
  const tokens = useThemeStore((s) => s.colors);
  const look = useThemeStore((s) => s.tokens);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: tokens.background,
          paddingTop: insets.top,
        },
        tabBarActiveTintColor: tokens.tabBarActiveTint,
        tabBarInactiveTintColor: tokens.tabBarInactiveTint,
        tabBarStyle: {
          backgroundColor: tokens.tabBarBackground,
          borderTopColor: tokens.tabBarBorder,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          // paddingBottom mirrors paddingTop with the safe-area inset added.
          // paddingTop:6 has no spacing step (xs=4, sm=8) and no exact
          // Top and bottom must stay symmetric, so BOTH take the same token.
          // The safe-area arithmetic is untouched — only the constant moves onto
          // the scale, which is what keeps the two sides in step under either look.
          paddingBottom: insets.bottom + look.spacing.sm,
          paddingTop: look.spacing.sm,
          maxWidth: 600,
          alignSelf: 'center',
          width: '100%',
        },
        tabBarLabelStyle: {
          fontSize: look.typography.label.size,
          fontWeight: look.typography.label.weight,
        },
        tabBarItemStyle: {
          flex: 1,
          maxWidth: 120,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: look.typography.heading.size }}>{'🏠'}</Text>,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: look.typography.heading.size }}>{'🔔'}</Text>,
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          title: 'Locations',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: look.typography.heading.size }}>{'📍'}</Text>,
        }}
      />
      <Tabs.Screen
        name="forecasts"
        options={{
          title: 'Forecasts',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: look.typography.heading.size }}>{'🌤️'}</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: look.typography.heading.size }}>{'⚙️'}</Text>,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          title: 'History',
        }}
      />
    </Tabs>
  );
}
