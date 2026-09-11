import { Stack } from 'expo-router';
import { useThemeStore } from '../../src/stores/themeStore';

export default function OnboardingLayout() {
  // `tokens` now holds STRUCTURE; colour moved to `colors` when the look axis
  // landed. Aliased rather than renamed so the JSX below stays untouched.
  const tokens = useThemeStore((s) => s.colors);

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
