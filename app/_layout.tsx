import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializePurchases, syncProStatus } from '../services/revenueCat';

export default function RootLayout() {
  useEffect(() => {
    initializePurchases();
    syncProStatus(); // sync entitlement status with RevenueCat on every launch
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
