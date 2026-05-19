import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = { children: React.ReactNode };

type State = { error: Error | null };

/** Prevents blank white screen after crashes on long mobile sessions. */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CapstoneMobile] render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Reloading usually fixes this on mobile.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={() => this.setState({ error: null })}>
            <Text style={styles.primaryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8F9FD',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  body: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 20 },
  primary: {
    backgroundColor: '#F54E25',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
