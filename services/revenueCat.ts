import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { setIsPro } from './storage';

// Add your keys from app.revenuecat.com → Project Settings → API Keys
const RC_IOS_KEY = 'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const RC_ANDROID_KEY = 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const PRO_ENTITLEMENT_ID = 'pro';

export function initializePurchases(): void {
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({
    apiKey: Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY,
  });
}

export async function syncProStatus(): Promise<boolean> {
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
  try {
    const offerings = await Purchases.getOfferings();
    const monthly = offerings.current?.monthly;
    if (!monthly) throw new Error('Pro offering not configured. Set it up in RevenueCat dashboard.');
    const { customerInfo } = await Purchases.purchasePackage(monthly);
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    await setIsPro(isPro);
    return { success: isPro, cancelled: false };
  } catch (e: any) {
    if (e.userCancelled) return { success: false, cancelled: true };
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    const isPro = info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    await setIsPro(isPro);
    return isPro;
  } catch {
    return false;
  }
}
