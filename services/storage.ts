import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_COUNT_KEY = 'daily_question_count';
const CONVERSATIONS_KEY = 'conversations';
const MAX_CONVERSATIONS = 50;

export const FREE_TIER_LIMIT = 5;
export const PRO_TIER_LIMIT = 30;

interface DailyCount {
  date: string;
  count: number;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: StoredMessage[];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function checkAndIncrementDailyCount(limit = FREE_TIER_LIMIT): Promise<boolean> {
  const raw = await AsyncStorage.getItem(DAILY_COUNT_KEY);
  const stored: DailyCount = raw ? JSON.parse(raw) : { date: today(), count: 0 };

  if (stored.date !== today()) {
    await AsyncStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ date: today(), count: 1 }));
    return true;
  }

  if (stored.count >= limit) return false;

  await AsyncStorage.setItem(
    DAILY_COUNT_KEY,
    JSON.stringify({ date: stored.date, count: stored.count + 1 }),
  );
  return true;
}

export async function getRemainingQuestions(limit = FREE_TIER_LIMIT): Promise<number> {
  const raw = await AsyncStorage.getItem(DAILY_COUNT_KEY);
  if (!raw) return limit;
  const stored: DailyCount = JSON.parse(raw);
  if (stored.date !== today()) return limit;
  return Math.max(0, limit - stored.count);
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  const list: Conversation[] = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex(c => c.id === conversation.id);
  if (idx >= 0) {
    list[idx] = conversation;
  } else {
    list.unshift(conversation);
    if (list.length > MAX_CONVERSATIONS) list.splice(MAX_CONVERSATIONS);
  }
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
}

export async function getConversations(): Promise<Conversation[]> {
  const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function deleteConversation(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  const list: Conversation[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(
    CONVERSATIONS_KEY,
    JSON.stringify(list.filter(c => c.id !== id)),
  );
}

export async function clearAllHistory(): Promise<void> {
  await AsyncStorage.removeItem(CONVERSATIONS_KEY);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  const list: Conversation[] = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex(c => c.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], title };
    await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
  }
}

const PRO_KEY = 'is_pro';

export async function getIsPro(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PRO_KEY);
  return raw === '1';
}

export async function setIsPro(value: boolean): Promise<void> {
  await AsyncStorage.setItem(PRO_KEY, value ? '1' : '0');
}

const USER_CONTEXT_KEY = 'user_context';

export async function getUserContext(): Promise<string> {
  const raw = await AsyncStorage.getItem(USER_CONTEXT_KEY);
  return raw ?? '';
}

export async function setUserContext(value: string): Promise<void> {
  await AsyncStorage.setItem(USER_CONTEXT_KEY, value);
}

const ONBOARDING_KEY = 'onboarding_seen';
const CONVERSATION_COUNT_KEY = 'conversation_count';

export async function hasSeenOnboarding(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
  return raw === '1';
}

export async function setOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export async function incrementAndGetConversationCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(CONVERSATION_COUNT_KEY);
  const count = raw ? parseInt(raw, 10) + 1 : 1;
  await AsyncStorage.setItem(CONVERSATION_COUNT_KEY, String(count));
  return count;
}

// ── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  role: string;
  maturity: string;
  framework: string;
}

const USER_PROFILE_KEY = 'user_profile';

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

// ── Favorites ────────────────────────────────────────────────────────────────

export interface Favorite {
  id: string;
  content: string;
  conversationTitle: string;
  savedAt: string;
}

const FAVORITES_KEY = 'favorites';
const MAX_FAVORITES = 100;

export async function getFavorites(): Promise<Favorite[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveFavorite(fav: Favorite): Promise<void> {
  const list = await getFavorites();
  if (list.some(f => f.id === fav.id)) return;
  list.unshift(fav);
  if (list.length > MAX_FAVORITES) list.splice(MAX_FAVORITES);
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
}

export async function deleteFavorite(id: string): Promise<void> {
  const list = await getFavorites();
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(list.filter(f => f.id !== id)));
}
