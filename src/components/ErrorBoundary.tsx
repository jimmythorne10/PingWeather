import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/**
 * App-wide error boundary. Catches unhandled JS errors that would otherwise
 * crash the React tree and shows a "something went wrong" screen with a
 * "Try again" button that unmounts + remounts the subtree.
 *
 * React error boundaries MUST be class components — there is no functional
 * equivalent for `componentDidCatch` in React 19.
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
    // Log for remote debugging later. When we add a crash reporter
    // (Sentry, Bugsnag, etc.), wire it in here.
    console.error('[ErrorBoundary] caught error:', error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>{'⚠️'}</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            PingWeather hit an unexpected error. Tap "Try again" to recover.
            If this keeps happening, close and reopen the app.
          </Text>
          {this.state.errorMessage && (
            <Text style={styles.errorDetail} selectable>
              {this.state.errorMessage}
            </Text>
          )}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try again</Text>
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
    backgroundColor: '#F0F4F8',
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
    color: '#1E3A5F',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  errorDetail: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#7B8794',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
