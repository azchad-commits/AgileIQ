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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { SYSTEM_PROMPT } from '../../constants/systemPrompt';
import { getApiKey } from '../../services/secureStorage';
import {
  checkAndIncrementDailyCount,
  getRemainingQuestions,
  saveConversation,
  getIsPro,
  getConversations,
} from '../../services/storage';
import { presentProPaywall } from '../../services/revenueCat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How do I run an effective Sprint Retrospective?',
  'What are the 8 stances of a Scrum Master?',
  'How should we handle technical debt in the backlog?',
  "What's the difference between a Product Owner and a Project Manager?",
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(5);
  const [isPro, setIsProState] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const conversationId = useRef(Date.now().toString());
  const streamingIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);

  // Ref mirrors — updated every render so `send` (stable []) always sees current values
  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  messagesRef.current = messages;
  loadingRef.current = loading;

  const { prompt, t, continueId } = useLocalSearchParams<{ prompt?: string; t?: string; continueId?: string }>();
  const lastParamKeyRef = useRef('');
  const lastContinueIdRef = useRef('');

  useEffect(() => {
    getRemainingQuestions().then(setRemaining);
    getIsPro().then(setIsProState);
  }, []);

  // Continue an existing conversation
  useEffect(() => {
    if (!continueId || continueId === lastContinueIdRef.current) return;
    lastContinueIdRef.current = continueId;
    getConversations().then(list => {
      const conv = list.find(c => c.id === continueId);
      if (!conv) return;
      setMessages(conv.messages.map((m, i) => ({ id: String(i), role: m.role, content: m.content })));
      conversationId.current = conv.id;
    });
  }, [continueId]);

  // Topics → Chat param
  useEffect(() => {
    const key = `${t ?? ''}::${prompt ?? ''}`;
    if (prompt && key !== lastParamKeyRef.current) {
      lastParamKeyRef.current = key;
      send(prompt);
    }
  // send is stable ([] deps) — intentional omission
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, t]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || loadingRef.current) return;

    const apiKey = await getApiKey();
    if (!apiKey) {
      setError('Add your Anthropic API key in Settings to get started.');
      return;
    }

    const pro = await getIsPro();
    if (!pro) {
      const allowed = await checkAndIncrementDailyCount();
      if (!allowed) {
        const upgraded = await presentProPaywall();
        if (upgraded) setIsProState(true);
        return;
      }
      setRemaining(r => Math.max(0, r - 1));
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
    const nextMessages = [...messagesRef.current, userMsg];
    setMessages(nextMessages);
    setInput('');
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
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? `API error ${res.status}`);
      }

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

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

      const finalMessages = [
        ...nextMessages,
        { id: assistantId, role: 'assistant' as const, content: fullText },
      ];
      await saveConversation({
        id: conversationId.current,
        title: content.slice(0, 60),
        date: new Date().toISOString(),
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
      });

    } catch (e: unknown) {
      const isAbort = e instanceof Error && e.name === 'AbortError';
      if (!isAbort) {
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        const msg = e instanceof Error ? e.message : 'Something went wrong.';
        const isOffline = msg.toLowerCase().includes('network request failed')
          || msg.toLowerCase().includes('failed to fetch');
        setError(isOffline ? 'No internet connection. Check your network and try again.' : msg);
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

  const startNewChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setInput('');
    conversationId.current = Date.now().toString();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AgileIQ</Text>
          <Text style={styles.headerSub}>AI Agile Coach</Text>
        </View>
        <View style={styles.headerRight}>
          {!isPro && (
            <Text style={[styles.remainingBadge, remaining <= 1 && styles.remainingLow]}>
              {remaining}/5 free today
            </Text>
          )}
          {isPro && <Text style={styles.proBadge}>Pro ✦</Text>}
          {messages.length > 0 && (
            <TouchableOpacity onPress={startNewChat} style={styles.newChatBtn} activeOpacity={0.7}>
              <Text style={styles.newChatText}>+ New</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<EmptyState onSuggestion={s => send(s)} />}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isStreaming={loading && item.id === streamingIdRef.current}
            onCopy={() => showToast('Copied')}
          />
        )}
      />

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
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={styles.inputWrapper}>
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
}: {
  message: Message;
  isStreaming: boolean;
  onCopy: () => void;
}) {
  const isUser = message.role === 'user';

  const handleLongPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(message.content);
    onCopy();
  };

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}
    >
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
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Ask your Agile coach</Text>
      <Text style={styles.emptySub}>
        Expert guidance on Scrum, SAFe, sprint planning, retrospectives, team dynamics, and more.
      </Text>
      {SUGGESTIONS.map(s => (
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

const markdownStyles = StyleSheet.create({
  body: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 23,
    backgroundColor: 'transparent',
  } as any,
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
    color: Colors.text,
  } as any,
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
  fence: {
    backgroundColor: Colors.navyMid,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  } as any,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.teal, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  remainingBadge: { fontSize: 11, color: Colors.grayDark, fontWeight: '500' },
  remainingLow: { color: Colors.error },
  proBadge: { fontSize: 12, color: Colors.teal, fontWeight: '700' },
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
  bubble: { maxWidth: '84%', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleUser: { backgroundColor: Colors.teal, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  senderLabel: { fontSize: 11, color: Colors.teal, fontWeight: '700', marginBottom: 4 },
  bubbleTextUser: { fontSize: 16, lineHeight: 23, color: Colors.white },
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.background,
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
  empty: { flex: 1, paddingHorizontal: 24, paddingTop: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 26, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  emptySub: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
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
