// ────────────────────────────────────────────────────────────
// WeatherWatch Theme Tokens
// Adapted from SocialUplink theme system
// ────────────────────────────────────────────────────────────

export interface ThemeTokens {
  // Backgrounds
  background: string;
  card: string;
  inputBackground: string;

  // Primary brand color
  primary: string;
  primaryLight: string;
  primaryDisabled: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;

  // Borders & dividers
  border: string;
  borderLight: string;
  divider: string;

  // Semantic colors
  success: string;
  successDark: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  info: string;

  // Weather-specific semantic colors
  freezeBlue: string;
  heatRed: string;
  rainBlue: string;
  windGray: string;

  // Navigation chrome
  headerBackground: string;
  headerTint: string;
  tabBarActiveTint: string;
  tabBarInactiveTint: string;
  tabBarBackground: string;
  tabBarBorder: string;
  statusBarStyle: 'light' | 'dark';
}

export type ThemeName = 'classic' | 'dark' | 'storm';

export const THEMES: Record<ThemeName, ThemeTokens> = {
  classic: {
    background: '#F0F4F8',
    card: '#FFFFFF',
    inputBackground: '#F7F9FC',

    primary: '#1E3A5F',       // Deep navy blue — trust, reliability
    primaryLight: '#E8EEF4',
    primaryDisabled: '#94A3B8',

    textPrimary: '#1A202C',
    textSecondary: '#4A5568',
    textTertiary: '#A0AEC0',
    textOnPrimary: '#FFFFFF',

    border: '#CBD5E0',
    borderLight: '#E2E8F0',
    divider: '#EDF2F7',

    success: '#38A169',
    successDark: '#276749',
    error: '#E53E3E',
    errorLight: '#FED7D7',
    warning: '#D69E2E',
    warningLight: '#FEFCBF',
    info: '#3182CE',

    freezeBlue: '#63B3ED',
    heatRed: '#FC8181',
    rainBlue: '#4299E1',
    windGray: '#A0AEC0',

    headerBackground: '#1E3A5F',
    headerTint: '#FFFFFF',
    tabBarActiveTint: '#1E3A5F',
    tabBarInactiveTint: '#A0AEC0',
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    statusBarStyle: 'light',
  },

  dark: {
    background: '#1A202C',
    card: '#2D3748',
    inputBackground: '#2D3748',

    primary: '#63B3ED',
    primaryLight: '#2A4365',
    primaryDisabled: '#4A5568',

    textPrimary: '#F7FAFC',
    textSecondary: '#CBD5E0',
    textTertiary: '#718096',
    textOnPrimary: '#1A202C',

    border: '#4A5568',
    borderLight: '#2D3748',
    divider: '#2D3748',

    success: '#48BB78',
    successDark: '#38A169',
    error: '#FC8181',
    errorLight: '#742A2A',
    warning: '#ECC94B',
    warningLight: '#5F370E',
    info: '#63B3ED',

    freezeBlue: '#90CDF4',
    heatRed: '#FEB2B2',
    rainBlue: '#63B3ED',
    windGray: '#CBD5E0',

    headerBackground: '#2D3748',
    headerTint: '#F7FAFC',
    tabBarActiveTint: '#63B3ED',
    tabBarInactiveTint: '#718096',
    tabBarBackground: '#2D3748',
    tabBarBorder: '#4A5568',
    statusBarStyle: 'light',
  },

  storm: {
    background: '#0F172A',
    card: '#1E293B',
    inputBackground: '#1E293B',

    primary: '#38BDF8',       // Electric sky blue
    primaryLight: '#0C4A6E',
    primaryDisabled: '#475569',

    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textOnPrimary: '#0F172A',

    border: '#334155',
    borderLight: '#1E293B',
    divider: '#1E293B',

    success: '#4ADE80',
    successDark: '#22C55E',
    error: '#F87171',
    errorLight: '#7F1D1D',
    warning: '#FBBF24',
    warningLight: '#713F12',
    info: '#38BDF8',

    freezeBlue: '#7DD3FC',
    heatRed: '#FCA5A5',
    rainBlue: '#38BDF8',
    windGray: '#94A3B8',

    headerBackground: '#1E293B',
    headerTint: '#F1F5F9',
    tabBarActiveTint: '#38BDF8',
    tabBarInactiveTint: '#64748B',
    tabBarBackground: '#1E293B',
    tabBarBorder: '#334155',
    statusBarStyle: 'light',
  },
};
