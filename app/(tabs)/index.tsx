import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { SYSTEM_PROMPT } from '../../constants/systemPrompt';
import { getApiKey } from '../../services/secureStorage';
import {
  checkAndIncrementDailyCount,
  getRemainingQuestions,
  saveConversation,
} from '../../services/storage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How do I run an effective Sprint Retrospective?',
  'What are the 8 stances of a Scrum Master?',
  "How should we handle technical debt in the backlog?",
  "What's the difference between a Product Owner and a Project Manager?",
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(5);
  const conversationId = useRef(Date.now().toString());
  const listRef = useRef<FlatList>(null);
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();

  useEffect(() => {
    getRemainingQuestions().then(setRemaining);
  }, []);

  useEffect(() => {
    if (prompt) send(prompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const apiKey = await getApiKey();
    if (!apiKey) {
      setError('Add your Anthropic API key in Settings to get started.');
      return;
    }

    const allowed = await checkAndIncrementDailyCount();
    if (!allowed) {
      setError("You've used all 5 free questions today. Upgrade to Pro for unlimited access.");
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);
    setRemaining(r => Math.max(0, r - 1));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? `API error ${res.status}`);
      }

      const data = await res.json();
      const assistantContent: string = data.content?.[0]?.text ?? '';
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);

      await saveConversation({
        id: conversationId.current,
        title: content.slice(0, 60),
        date: new Date().toISOString(),
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Check your connection.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleSend = useCallback(() => send(input), [send, input]);

  const handleSuggestion = useCallback((text: string) => send(text), [send]);

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
          <Text style={[styles.remainingBadge, remaining <= 1 && styles.remainingLow]}>
            {remaining}/5 free today
          </Text>
          {messages.length > 0 && (
            <TouchableOpacity onPress={startNewChat} style={styles.newChatBtn} activeOpacity={0.7}>
              <Text style={styles.newChatText}>+ New Chat</Text>
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
        ListEmptyComponent={<EmptyState onSuggestion={handleSuggestion} />}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />

      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.sendArrow}>↑</Text>
            }
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {!isUser && <Text style={styles.senderLabel}>AgileIQ</Text>}
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
          {message.content}
        </Text>
      </View>
    </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  remainingBadge: {
    fontSize: 11,
    color: Colors.grayDark,
    fontWeight: '500',
  },
  remainingLow: {
    color: Colors.error,
  },
  newChatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  newChatText: {
    fontSize: 12,
    color: Colors.teal,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  listEmpty: {
    flex: 1,
  },
  bubbleRow: {
    alignItems: 'flex-start',
  },
  bubbleRowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    backgroundColor: Colors.teal,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderLabel: {
    fontSize: 11,
    color: Colors.teal,
    fontWeight: '700',
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 23,
  },
  bubbleTextUser: {
    color: Colors.white,
  },
  bubbleTextAssistant: {
    color: Colors.text,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.errorDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
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
  sendBtnDisabled: {
    backgroundColor: Colors.navyMid,
  },
  sendArrow: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  empty: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
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
  suggestionText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  suggestionArrow: {
    color: Colors.teal,
    fontSize: 22,
    marginLeft: 8,
    fontWeight: '300',
  },
});
