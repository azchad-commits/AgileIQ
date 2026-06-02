import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { setIsPro } from './storage';
import { createPaywallPromise } from './paywallBridge';

// Add your keys from app.revenuecat.com → Project Settings → API Keys
const RC_IOS_KEY = 'appl_ZokAwbqPypPkTKAdDgXFsOYhabo';
const RC_ANDROID_KEY = '';
const PRO_ENTITLEMENT_ID = 'pro';

function getApiKey(): string {
  return Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
}

function isConfigured(): boolean {
  return getApiKey().length > 0;
}

export function initializePurchases(): void {
  if (!isConfigured()) return;
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: getApiKey() });
}

export async function syncProStatus(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    const isPro = info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    await setIsPro(isPro);
    return isPro;
  } catch {
    return false;
  }
}

export async function purchasePro(): Promise<{ success: boolean; cancelled: boolean }> {
  if (!isConfigured()) throw new Error('RevenueCat not configured. Add your API key to services/revenueCat.ts.');
  try {
    const offerings = await Purchases.getOfferings();
    const monthly = offerings.current?.monthly;
    if (!monthly) throw new Error('Pro offering not found. Configure it in your RevenueCat dashboard.');
    const { customerInfo } = await Purchases.purchasePackage(monthly);
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    await setIsPro(isPro);
    return { success: isPro, cancelled: false };
  } catch (e: any) {
    if (e.userCancelled) return { success: false, cancelled: true };
    throw e;
  }
}

export async function presentProPaywall(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current ?? Object.values(offerings.all)[0] ?? undefined;
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      offering,
    });
    const purchased = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    if (purchased) await setIsPro(true);
    return purchased;
  } catch {
    // RevenueCatUI failed (e.g. no paywall template wired up) — use custom paywall screen
    const promise = createPaywallPromise();
    router.push('/paywall');
    return promise;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const info = await Purchases.restorePurchases();
    const isPro = info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    await setIsPro(isPro);
    return isPro;
  } catch {
    return false;
  }
}
