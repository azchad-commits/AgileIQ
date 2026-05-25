import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import QuickActions from 'react-native-quick-actions';
import { initializePurchases, syncProStatus } from '../services/revenueCat';
import { hasSeenOnboarding, setOnboardingSeen } from '../services/storage';
import { getTodaysTip } from '../services/notifications';
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

    // Register and handle home screen quick actions
    QuickActions.setShortcutItems([
      { type: 'newchat', title: 'New Chat', subtitle: 'Start a fresh session', icon: 'Compose', userInfo: { url: '' } },
      { type: 'dailytip', title: 'Daily Tip', subtitle: "Today's Agile insight", icon: 'Bookmark', userInfo: { url: '' } },
      { type: 'retro', title: 'Start Retro', subtitle: 'Sprint retrospective', icon: 'Time', userInfo: { url: '' } },
    ]);
    QuickActions.popInitialAction().then(action => {
      if (!action) return;
      const t = Date.now().toString();
      setTimeout(() => {
        if (action.type === 'newchat') {
          router.navigate({ pathname: '/', params: { newChat: '1', t } });
        } else if (action.type === 'dailytip') {
          const tip = getTodaysTip();
          router.navigate({ pathname: '/', params: { prompt: `Tell me more about this coaching insight: "${tip}"`, t, newChat: '1' } });
        } else if (action.type === 'retro') {
          router.navigate({ pathname: '/', params: { prompt: 'Help me run a Sprint Retrospective. Suggest a format and structure it for my team.', t, newChat: '1' } });
        }
      }, 300);
    });

    return () => {
      appStateSub.remove();
      notifSub.remove();
    };
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
