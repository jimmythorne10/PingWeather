import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeStore } from '../stores/themeStore';

/**
 * App-wide error boundary. Catches unhandled JS errors that would otherwise
 * crash the React tree and shows a "something went wrong" screen with a
 * "Try again" button that unmounts + remounts the subtree.
 *
 * React error boundaries MUST be class components — there is no functional
 * equivalent for `componentDidCatch` in React 19.
 *
 * Theme: class components cannot use hooks, so we read the current tokens
 * synchronously from the store's getState() at render time. This gives us the
 * correct dark/storm theme colors on crash without a subscription.
 *
 * Crash reporter: wire @sentry/react-native (or equivalent) in
 * componentDidCatch before production. The call site is marked below.
 *
 * This is a safety net, not a substitute for real error handling at the
 * call site. Individual API calls should still catch and surface their
 * own errors via store `error` state.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message ?? 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string | null }) {
    // TODO(pre-production): replace with Sentry.captureException(error, { extra: errorInfo })
    // after wiring @sentry/react-native. The console.error below is silent in
    // production builds — crashes are invisible without a real reporter.
    console.error('[ErrorBoundary] caught error:', error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      // Read theme tokens synchronously — safe in a class render because
      // getState() is a plain object read, not a subscription.
      const tokens = useThemeStore.getState().tokens;

      return (
        <View style={[styles.container, { backgroundColor: tokens.background }]}>
          <Text style={styles.icon}>{'⚠️'}</Text>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Something went wrong</Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            WeatherBeacon hit an unexpected error. Tap "Try again" to recover.
            If this keeps happening, close and reopen the app.
          </Text>
          {this.state.errorMessage && (
            <Text style={[styles.errorDetail, { color: tokens.textTertiary }]} selectable>
              {this.state.errorMessage}
            </Text>
          )}
          <Pressable style={[styles.button, { backgroundColor: tokens.primary }]} onPress={this.handleReset}>
            <Text style={[styles.buttonText, { color: tokens.textOnPrimary }]}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  errorDetail: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
