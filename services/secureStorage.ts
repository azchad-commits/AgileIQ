import * as SecureStore from 'expo-secure-store';

const API_KEY_STORE_KEY = 'anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORE_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_STORE_KEY, key);
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORE_KEY);
}
