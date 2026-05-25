import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializePurchases, syncProStatus } from '../services/revenueCat';
import { hasSeenOnboarding, setOnboardingSeen } from '../services/storage';
import { OnboardingModal } from '../components/OnboardingModal';

export default function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    initializePurchases();
    syncProStatus();
    hasSeenOnboarding().then(seen => {
      if (!seen) setShowOnboarding(true);
    });
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
