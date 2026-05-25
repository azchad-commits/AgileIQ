import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { initializePurchases, syncProStatus } from '../services/revenueCat';
import { hasSeenOnboarding, setOnboardingSeen } from '../services/storage';
import { getTodaysTip } from '../services/notifications';
import { OnboardingModal } from '../components/OnboardingModal';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    initializePurchases();
    syncProStatus();
    hasSeenOnboarding().then(seen => {
      if (!seen) setShowOnboarding(true);
    });

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        syncProStatus();
      }
      appStateRef.current = nextState;
    });

    // Navigate into chat when user taps the daily tip notification
    const notifSub = Notifications.addNotificationResponseReceivedListener(response => {
      const tipPrompt = response.notification.request.content.data?.tipPrompt as string | undefined;
      if (tipPrompt) {
        setTimeout(() => {
          router.navigate({ pathname: '/', params: { prompt: tipPrompt, t: Date.now().toString(), newChat: '1' } });
        }, 300);
      }
    });

    return () => {
      appStateSub.remove();
      notifSub.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
