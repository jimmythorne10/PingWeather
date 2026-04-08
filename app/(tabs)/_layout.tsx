import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../src/stores/themeStore';

export default function TabLayout() {
  const tokens = useThemeStore((s) => s.tokens);
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
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          flex: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'🏠'}</Text>,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'🔔'}</Text>,
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          title: 'Locations',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'📍'}</Text>,
        }}
      />
      <Tabs.Screen
        name="forecasts"
        options={{
          title: 'Forecasts',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'🌤️'}</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'⚙️'}</Text>,
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
