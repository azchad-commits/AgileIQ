import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializePurchases, syncProStatus } from '../services/revenueCat';
import { hasSeenOnboarding, setOnboardingSeen } from '../services/storage';
import { OnboardingModal } from '../components/OnboardingModal';

export default function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    initializePurchases();
    syncProStatus();
    hasSeenOnboarding().then(seen => {
      if (!seen) setShowOnboarding(true);
    });

    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        syncProStatus();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      <OnboardingModal
        visible={showOnboarding}
        onDismiss={async () => {
          await setOnboardingSeen();
          setShowOnboarding(false);
        }}
      />
    </SafeAreaProvider>
  );
}
