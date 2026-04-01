import { Stack } from 'expo-router';
import { useThemeStore } from '../../src/stores/themeStore';

export default function OnboardingLayout() {
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
