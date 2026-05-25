import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Linking,
  Share,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { buildSystemPrompt } from '../../constants/systemPrompt';
import { getApiKey, getAppApiKey } from '../../services/secureStorage';
import { presentProPaywall } from '../../services/revenueCat';
import {
  saveConversation,
  getConversations,
  incrementAndGetConversationCount,
  getUserContext,
  getUserProfile,
  saveFavorite,
  getRemainingQuestions,
  getIsPro,
  checkAndIncrementDailyCount,
  getResponseStyle,
  getStreak,
  updateStreak,
  FREE_TIER_LIMIT,
  PRO_TIER_LIMIT,
  type Favorite,
  type ResponseStyle,
  type UserProfile,
} from '../../services/storage';
import { friendlyApiError, isNetworkError } from '../../services/apiErrors';
import { getTodaysTip } from '../../services/notifications';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

const RATING_MILESTONES = new Set([3, 10, 25]);
const STREAK_MILESTONES = new Set([7, 14, 30]);
// Fill in once the app is submitted to the App Store
const APP_STORE_ID = '';

function promptAppRating() {
  if (!APP_STORE_ID) return;
  Alert.alert(
    'Enjoying AgileIQ?',
    'Would you like to leave a review? It really helps!',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Rate App',
        onPress: () => {
          const url = Platform.OS === 'ios'
            ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
            : 'market://details?id=com.agileiq.app';
          Linking.openURL(url).catch(() => {});
        },
      },
    ],
  );
}

const DEFAULT_SUGGESTIONS = [
  'How do I run an effective Sprint Retrospective?',
  'What are the 8 stances of a Scrum Master?',
  'How should we handle technical debt in the backlog?',
  "What's the difference between a Product Owner and a Project Manager?",
];

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  'Scrum Master': [
    'How do I handle a team that skips the Daily Scrum?',
    'My team has low psychological safety. Where do I start?',
    'How do I coach without giving the answer?',
    'What does removing impediments actually look like?',
  ],
  'Agile Coach': [
    'What coaching stances should I shift between?',
    'How do I coach a PO who keeps changing priorities mid-sprint?',
    'What does a healthy agile transformation look like at scale?',
    'How do I measure the impact of my coaching?',
  ],
  'Product Owner': [
    'How do I write acceptance criteria that actually close conversations?',
    'What makes a healthy Product Backlog?',
    'How do I say no to stakeholders without damaging relationships?',
    'How do I articulate a clear and compelling Product Goal?',
  ],
  'Developer': [
    'What is the Definition of Done and why does it matter?',
    'How do we manage technical debt without ignoring features?',
    'How do I estimate story points with more confidence?',
    'What does real Developer ownership in Scrum look like?',
  ],
  'Manager': [
    'How do I support self-organizing teams without micromanaging?',
    'What Agile metrics should I actually track?',
    'How do I set stakeholder expectations in Scrum?',
    'What does servant leadership look like day-to-day?',
  ],
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

const FOLLOW_UP_POOL = [
  'Give me a concrete example',
  'How do I apply this to my team?',
  'What are the common pitfalls?',
  'What should I do first?',
  'How does this scale?',
  'What does the Scrum Guide say?',
  'What if the team is resistant?',
  'How do we measure success here?',
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isByok, setIsByok] = useState(false);
  const [remaining, setRemaining] = useState(FREE_TIER_LIMIT);
  const [streak, setStreak] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const conversationId = useRef(Date.now().toString());
  const conversationTitleRef = useRef('');
  const streamingIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryContentRef = useRef<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Ref mirrors — updated every render so `send` (stable []) always sees current values
  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const inputRef = useRef('');
  const byokKeyRef = useRef<string | null>(null);
  const isProRef = useRef(false);
  const responseStyleRef = useRef<ResponseStyle>('balanced');
  messagesRef.current = messages;
  loadingRef.current = loading;
  inputRef.current = input;

  const refreshTierStatus = useCallback(async () => {
    const [byokKey, pro, style, prof, streakCount] = await Promise.all([
      getApiKey(), getIsPro(), getResponseStyle(), getUserProfile(), getStreak(),
    ]);
    byokKeyRef.current = byokKey;
    isProRef.current = pro;
    responseStyleRef.current = style;
    const byok = !!byokKey;
    setIsByok(byok);
    setIsPro(pro);
    setProfile(prof);
    setStreak(streakCount);
    if (!byok) setRemaining(await getRemainingQuestions(pro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT));
  }, []);

  const { prompt, t, continueId, newChat } = useLocalSearchParams<{ prompt?: string; t?: string; continueId?: string; newChat?: string }>();
  const lastParamKeyRef = useRef('');
  const lastContinueIdRef = useRef('');

  // Continue an existing conversation
  useEffect(() => {
    if (!continueId || continueId === lastContinueIdRef.current) return;
    lastContinueIdRef.current = continueId;
    getConversations().then(list => {
      const conv = list.find(c => c.id === continueId);
      if (!conv) return;
      setMessages(conv.messages.map((m, i) => ({ id: String(i), role: m.role, content: m.content })));
      conversationId.current = conv.id;
      conversationTitleRef.current = conv.title;
    });
  }, [continueId]);

  // Prompt param (from Topics, Tools, etc.)
  useEffect(() => {
    const key = `${t ?? ''}::${prompt ?? ''}`;
    if (prompt && key !== lastParamKeyRef.current) {
      lastParamKeyRef.current = key;
      if (newChat === '1') {
        // Reset conversation synchronously via refs so send() sees a clean slate
        messagesRef.current = [];
        setMessages([]);
        setError(null);
        setIsOffline(false);
        conversationId.current = Date.now().toString();
        conversationTitleRef.current = '';
        AsyncStorage.setItem('chat_draft', '');
      }
      send(prompt);
    }
  // send is stable ([] deps) — intentional omission
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, t, newChat]);

  // Refresh tier status + restore draft on focus
  useFocusEffect(useCallback(() => {
    refreshTierStatus();
    AsyncStorage.getItem('chat_draft').then(draft => {
      if (draft && messagesRef.current.length === 0) setInput(draft);
    });
    return () => { AsyncStorage.setItem('chat_draft', inputRef.current); };
  }, [refreshTierStatus]));

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || loadingRef.current) return;
    retryContentRef.current = null;
    setIsOffline(false);

    const byokKey = byokKeyRef.current;
    const appKey = getAppApiKey();
    const apiKey = byokKey ?? appKey;

    if (!apiKey) {
      setError('No API key configured. Please add your Anthropic API key in Settings.');
      return;
    }

    // Non-BYOK: enforce daily limit and paywall
    if (!byokKey) {
      let pro = isProRef.current;
      let limit = pro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
      let allowed = await checkAndIncrementDailyCount(limit);

      if (!allowed) {
        if (!pro) {
          const upgraded = await presentProPaywall();
          if (!upgraded) return;
          // Upgrade succeeded — retry with Pro limit and continue sending
          setIsPro(true);
          isProRef.current = true;
          pro = true;
          limit = PRO_TIER_LIMIT;
          allowed = await checkAndIncrementDailyCount(limit);
          if (!allowed) {
            setError(`You've reached your ${PRO_TIER_LIMIT} question limit for today. Come back tomorrow!`);
            return;
          }
          setRemaining(await getRemainingQuestions(PRO_TIER_LIMIT));
        } else {
          setError(`You've reached your ${PRO_TIER_LIMIT} question limit for today. Come back tomorrow!`);
          return;
        }
      } else {
        setRemaining(r => Math.max(0, r - 1));
      }
    }

    const [userCtx, profile] = await Promise.all([getUserContext(), getUserProfile()]);
    const systemPromptText = buildSystemPrompt(profile, userCtx, responseStyleRef.current);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: Date.now() };
    const nextMessages = [...messagesRef.current, userMsg];
    setMessages(nextMessages);
    setInput('');
    AsyncStorage.setItem('chat_draft', '');
    setError(null);
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    streamingIdRef.current = assistantId;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          stream: true,
          system: [{ type: 'text', text: systemPromptText, cache_control: { type: 'ephemeral' } }],
          messages: nextMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errType: string = (err as any)?.error?.type ?? '';
        const errMsg: string = (err as any)?.error?.message ?? `API error ${res.status}`;
        throw new Error(`${errType}:${errMsg}`);
      }

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming not supported on this platform.');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              fullText += parsed.delta.text;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m),
              );
            }
          } catch {}
        }
      }

      streamingIdRef.current = null;

      // Preserve title across saves — only set it on the first message
      if (!conversationTitleRef.current) {
        conversationTitleRef.current = content.slice(0, 60);
      }

      const finalMessages = [
        ...nextMessages,
        { id: assistantId, role: 'assistant' as const, content: fullText },
      ];
      await saveConversation({
        id: conversationId.current,
        title: conversationTitleRef.current,
        date: new Date().toISOString(),
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
      });

      if (nextMessages.filter(m => m.role === 'user').length === 1) {
        const [count, newStreak] = await Promise.all([
          incrementAndGetConversationCount(),
          updateStreak(),
        ]);
        setStreak(newStreak);
        if (STREAK_MILESTONES.has(newStreak)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setToast(`🔥 ${newStreak}-day streak! Keep coaching.`);
          setTimeout(() => setToast(null), 2500);
        }
        if (RATING_MILESTONES.has(count)) {
          setTimeout(promptAppRating, 1200);
        }
      }

    } catch (e: unknown) {
      const isAbort = e instanceof Error && e.name === 'AbortError';
      if (!isAbort) {
        setMessages(prev => prev.filter(m => m.id !== assistantId && m.id !== userMsg.id));
        retryContentRef.current = content;
        if (isNetworkError(e)) setIsOffline(true);
        setError(friendlyApiError(e));
      }
      streamingIdRef.current = null;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const handleSend = useCallback(() => send(input), [send, input]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSaveMessage = useCallback(async (msg: Message) => {
    const fav: Favorite = {
      id: msg.id,
      content: msg.content,
      conversationTitle: conversationTitleRef.current || 'Conversation',
      savedAt: new Date().toISOString(),
    };
    await saveFavorite(fav);
    showToast('Saved to Favorites');
  }, [showToast]);

  const handleShareMessage = useCallback(async (msg: Message) => {
    try {
      await Share.share({ message: msg.content });
    } catch {}
  }, []);

  const startNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput('');
    setIsOffline(false);
    setShowScrollBtn(false);
    AsyncStorage.setItem('chat_draft', '');
    conversationId.current = Date.now().toString();
    conversationTitleRef.current = '';
  }, []);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <View style={styles.headerBadgeRow}>
            {(isByok || isPro) ? (
              <Text style={styles.proBadge}>Pro ✦</Text>
            ) : (
              <Text style={[styles.remainingBadge, remaining <= 1 && styles.remainingLow]}>
                {remaining}/{FREE_TIER_LIMIT} free today
              </Text>
            )}
            {streak >= 2 && (
              <Text style={styles.streakBadge}>🔥 {streak}</Text>
            )}
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={startNewChat} style={styles.newChatBtn} activeOpacity={0.7}>
              <Text style={styles.newChatText}>+ New</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>No internet connection</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={<EmptyState onSuggestion={s => send(s)} profile={profile} />}
        ListFooterComponent={
          !loading && messages.length > 0
            ? <FollowUpChips messages={messages} onSelect={send} />
            : null
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isStreaming={loading && item.id === streamingIdRef.current}
            onCopy={() => showToast('Copied')}
            onSave={() => handleSaveMessage(item)}
            onShare={() => handleShareMessage(item)}
          />
        )}
      />

      {showScrollBtn && (
        <TouchableOpacity
          style={styles.scrollBtn}
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          activeOpacity={0.8}
        >
          <Text style={styles.scrollBtnIcon}>↓</Text>
        </TouchableOpacity>
      )}

      {!!toast && (
        <View style={styles.toastWrapper} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      )}

      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          {retryContentRef.current && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setError(null); send(retryContentRef.current!); }}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={styles.inputOuter}>
          {input.length > 800 && (
            <Text style={[styles.charCount, input.length > 950 && styles.charCountWarn]}>
              {1000 - input.length} chars left
            </Text>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about Agile, Scrum, SAFe..."
              placeholderTextColor={Colors.grayDark}
              multiline
              maxLength={1000}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSend}
            />
            {loading ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
                <Text style={styles.cancelIcon}>✕</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.sendArrow}>↑</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const seq = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 250, useNativeDriver: true }),
          Animated.delay(Math.max(0, 480 - delay)),
        ]),
      );
    const anim = Animated.parallel([seq(dot1, 0), seq(dot2, 160), seq(dot3, 320)]);
    anim.start();
    return () => anim.stop();
  }, [dot1, dot2, dot3]);

  return (
    <View style={dotStyles.row}>
      <Animated.View style={[dotStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[dotStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[dotStyles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.teal },
});

function MessageBubble({
  message,
  isStreaming,
  onCopy,
  onSave,
  onShare,
}: {
  message: Message;
  isStreaming: boolean;
  onCopy: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  const isUser = message.role === 'user';

  const handleLongPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(message.content);
    onCopy();
  };

  const handleCopy = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.content);
    onCopy();
  };

  const timeLabel = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View style={styles.bubbleWrap}>
        <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.85}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
            {!isUser && <Text style={styles.senderLabel}>AgileIQ</Text>}
            {isUser ? (
              <Text style={styles.bubbleTextUser}>{message.content}</Text>
            ) : isStreaming && !message.content ? (
              <TypingDots />
            ) : (
              <Markdown style={markdownStyles}>
                {message.content + (isStreaming ? '▌' : '')}
              </Markdown>
            )}
            {timeLabel && !isStreaming && (
              <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>{timeLabel}</Text>
            )}
          </View>
        </TouchableOpacity>
        {!isUser && !isStreaming && !!message.content && (
          <View style={styles.msgActions}>
            <TouchableOpacity onPress={handleCopy} style={styles.msgAction} activeOpacity={0.7}>
              <Text style={styles.msgActionText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={styles.msgAction} activeOpacity={0.7}>
              <Text style={styles.msgActionText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onShare} style={styles.msgAction} activeOpacity={0.7}>
              <Text style={styles.msgActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function TipCard({ tip, onAsk }: { tip: string; onAsk: (text: string) => void }) {
  return (
    <TouchableOpacity
      style={styles.tipCard}
      onPress={() => onAsk(`Tell me more about this coaching insight: "${tip}"`)}
      activeOpacity={0.8}
    >
      <Text style={styles.tipLabel}>💡 DAILY TIP</Text>
      <Text style={styles.tipText}>{tip}</Text>
      <Text style={styles.tipCta}>Tap to explore →</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ onSuggestion, profile }: { onSuggestion: (text: string) => void; profile: UserProfile | null }) {
  const roleSuggestions = profile?.role ? ROLE_SUGGESTIONS[profile.role] : null;
  const suggestions = roleSuggestions ?? DEFAULT_SUGGESTIONS;
  const greeting = profile?.role
    ? `${getGreeting()}, ${profile.role}`
    : getGreeting();

  return (
    <View style={styles.empty}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.emptyLogo}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>{greeting}</Text>
      <Text style={styles.emptySub}>
        I'm AgileIQ. Ask me anything about Scrum, SAFe, coaching, sprints, and more.
      </Text>
      <TipCard tip={getTodaysTip()} onAsk={onSuggestion} />
      {suggestions.map(s => (
        <TouchableOpacity
          key={s}
          style={styles.suggestion}
          onPress={() => onSuggestion(s)}
          activeOpacity={0.7}
        >
          <Text style={styles.suggestionText}>{s}</Text>
          <Text style={styles.suggestionArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FollowUpChips({ messages, onSelect }: { messages: Message[]; onSelect: (text: string) => void }) {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || !last.content) return null;
  const count = messages.filter(m => m.role === 'assistant').length;
  const start = ((count - 1) * 3) % FOLLOW_UP_POOL.length;
  const chips = [0, 1, 2].map(i => FOLLOW_UP_POOL[(start + i) % FOLLOW_UP_POOL.length]);
  return (
    <View style={styles.followUps}>
      {chips.map(chip => (
        <TouchableOpacity key={chip} style={styles.followUpChip} onPress={() => onSelect(chip)} activeOpacity={0.7}>
          <Text style={styles.followUpText}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: Colors.text, fontSize: 16, lineHeight: 23, backgroundColor: 'transparent' } as any,
  paragraph: { marginTop: 0, marginBottom: 6, color: Colors.text } as any,
  heading1: { color: Colors.white, fontSize: 19, fontWeight: '700', marginVertical: 6 } as any,
  heading2: { color: Colors.white, fontSize: 17, fontWeight: '700', marginVertical: 4 } as any,
  heading3: { color: Colors.teal, fontSize: 16, fontWeight: '700', marginVertical: 4 } as any,
  strong: { fontWeight: '700', color: Colors.white } as any,
  em: { fontStyle: 'italic' } as any,
  bullet_list: { marginLeft: 0 } as any,
  ordered_list: { marginLeft: 0 } as any,
  list_item: { color: Colors.text, fontSize: 16, lineHeight: 23 } as any,
  bullet_list_icon: { color: Colors.teal, marginRight: 6 } as any,
  ordered_list_icon: { color: Colors.teal, marginRight: 6 } as any,
  code_inline: {
    backgroundColor: Colors.navyMid,
    color: Colors.tealLight,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    borderRadius: 4,
    paddingHorizontal: 4,
  } as any,
  fence: { backgroundColor: Colors.navyMid, borderRadius: 8, padding: 12, marginVertical: 8 } as any,
  code_block: {
    color: Colors.tealLight,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    backgroundColor: 'transparent',
  } as any,
  blockquote: {
    backgroundColor: Colors.navyMid,
    borderLeftWidth: 3,
    borderLeftColor: Colors.teal,
    paddingLeft: 12,
    paddingVertical: 6,
    marginVertical: 6,
  } as any,
  hr: { backgroundColor: Colors.border, height: 1, marginVertical: 10 } as any,
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 148, height: 44, borderRadius: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.teal, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakBadge: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  proBadge: { fontSize: 12, color: Colors.teal, fontWeight: '700' },
  remainingBadge: { fontSize: 11, color: Colors.grayDark, fontWeight: '500' },
  remainingLow: { color: Colors.error },
  newChatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  newChatText: { fontSize: 12, color: Colors.teal, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 },
  listEmpty: { flex: 1 },
  bubbleRow: { alignItems: 'flex-start' },
  bubbleRowUser: { alignItems: 'flex-end' },
  bubbleWrap: { maxWidth: '84%' },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleUser: { backgroundColor: Colors.teal, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  senderLabel: { fontSize: 11, color: Colors.teal, fontWeight: '700', marginBottom: 4 },
  bubbleTextUser: { fontSize: 16, lineHeight: 23, color: Colors.white },
  bubbleTime: { fontSize: 11, color: Colors.grayDark, marginTop: 6, textAlign: 'left' },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.errorDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: { color: Colors.error, fontSize: 14, lineHeight: 20 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { color: Colors.teal, fontSize: 13, fontWeight: '600' },
  inputOuter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  charCount: {
    fontSize: 11,
    color: Colors.grayDark,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  charCountWarn: { color: Colors.error },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.navyMid },
  sendArrow: { color: Colors.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelIcon: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  msgActions: { flexDirection: 'row', gap: 14, marginTop: 4, marginLeft: 4 },
  msgAction: {},
  msgActionText: { fontSize: 11, color: Colors.grayDark, fontWeight: '500' },
  followUps: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, gap: 8 },
  followUpChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followUpText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  offlineBanner: {
    backgroundColor: Colors.errorDim,
    borderBottomWidth: 1,
    borderBottomColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineText: { fontSize: 13, color: Colors.error, fontWeight: '500' },
  scrollBtn: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollBtnIcon: { fontSize: 18, color: Colors.teal, fontWeight: '700', marginTop: -1 },
  empty: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },
  emptyLogo: { width: 240, height: 130, borderRadius: 16, marginBottom: 16 },
  emptyTitle: { fontSize: 26, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  emptySub: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  tipCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  tipLabel: { fontSize: 10, fontWeight: '700', color: Colors.teal, letterSpacing: 0.8, marginBottom: 8 },
  tipText: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 10 },
  tipCta: { fontSize: 12, color: Colors.teal, fontWeight: '600' },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: { flex: 1, color: Colors.textSecondary, fontSize: 15, lineHeight: 21 },
  suggestionArrow: { color: Colors.teal, fontSize: 22, marginLeft: 8, fontWeight: '300' },
});
