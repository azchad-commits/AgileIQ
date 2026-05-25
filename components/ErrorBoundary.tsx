import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AgileIQ] Unhandled error:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>AgileIQ ran into an unexpected error. Your conversations are safe.</Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => this.setState({ hasError: false })}
            activeOpacity={0.8}
          >
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 52, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: {
    backgroundColor: Colors.teal,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
