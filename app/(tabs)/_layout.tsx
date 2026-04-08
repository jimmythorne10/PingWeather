import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useThemeStore } from '../../src/stores/themeStore';

export default function TabLayout() {
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.tabBarActiveTint,
        tabBarInactiveTintColor: tokens.tabBarInactiveTint,
        tabBarStyle: {
          backgroundColor: tokens.tabBarBackground,
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
          title: 'History',
          tabBarButton: () => null,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'📜'}</Text>,
        }}
      />
    </Tabs>
  );
}
