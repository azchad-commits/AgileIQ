import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_COUNT_KEY = 'daily_question_count';
const CONVERSATIONS_KEY = 'conversations';
const FREE_TIER_LIMIT = 5;
const MAX_CONVERSATIONS = 50;

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

export async function checkAndIncrementDailyCount(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(DAILY_COUNT_KEY);
  const stored: DailyCount = raw ? JSON.parse(raw) : { date: today(), count: 0 };

  if (stored.date !== today()) {
    await AsyncStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ date: today(), count: 1 }));
    return true;
  }

  if (stored.count >= FREE_TIER_LIMIT) return false;

  await AsyncStorage.setItem(
    DAILY_COUNT_KEY,
    JSON.stringify({ date: stored.date, count: stored.count + 1 }),
  );
  return true;
}

export async function getRemainingQuestions(): Promise<number> {
  const raw = await AsyncStorage.getItem(DAILY_COUNT_KEY);
  if (!raw) return FREE_TIER_LIMIT;
  const stored: DailyCount = JSON.parse(raw);
  if (stored.date !== today()) return FREE_TIER_LIMIT;
  return Math.max(0, FREE_TIER_LIMIT - stored.count);
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
