import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { getConversations, renameConversation, type Conversation } from '../../services/storage';
import { getApiKey, getAppApiKey } from '../../services/secureStorage';

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    getConversations().then(list => {
      setConversation(list.find(c => c.id === id) ?? null);
    });
  }, [id]);

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleStartEditTitle = () => {
    setTitleDraft(conversation!.title);
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== conversation!.title) {
      await renameConversation(id!, trimmed);
      setConversation(prev => prev ? { ...prev, title: trimmed } : prev);
    }
    setEditingTitle(false);
  };

  const handleSummarize = async () => {
    const byokKey = await getApiKey();
    const apiKey = byokKey ?? getAppApiKey();
    if (!apiKey) return;
    setSummarizing(true);
    setSummaryText('');
    setSummaryVisible(true);
    try {
      const transcript = conversation!.messages
        .map(m => `${m.role === 'user' ? 'User' : 'AgileIQ'}: ${m.content}`)
        .join('\n\n');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `Summarize the key coaching insights and action items from this AgileIQ conversation in 4–5 concise bullet points. Focus on what was learned and what to do next.\n\n${transcript}`,
          }],
        }),
      });
      const data = await res.json();
      setSummaryText(data.content?.[0]?.text ?? 'Could not generate summary.');
    } catch {
      setSummaryText('Something went wrong. Please try again.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleShare = async () => {
    const text = conversation.messages
      .map(m => `${m.role === 'user' ? 'You' : 'AgileIQ'}: ${m.content}`)
      .join('\n\n');
    await Share.share({ message: `${conversation.title}\n\n${text}` });
  };

  const date = new Date(conversation.date);
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {editingTitle ? (
            <TextInput
              style={styles.titleInput}
              value={titleDraft}
              onChangeText={setTitleDraft}
              onBlur={handleSaveTitle}
              onSubmitEditing={handleSaveTitle}
              returnKeyType="done"
              autoFocus
              maxLength={80}
            />
          ) : (
            <TouchableOpacity onPress={handleStartEditTitle} activeOpacity={0.7}>
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle} numberOfLines={1}>{conversation.title}</Text>
                <Text style={styles.editHint}> ✎</Text>
              </View>
            </TouchableOpacity>
          )}
          <Text style={styles.headerDate}>{formattedDate}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.7}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={conversation.messages}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DetailBubble role={item.role} content={item.content} />
        )}
      />

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.summarizeBtn}
            onPress={handleSummarize}
            activeOpacity={0.8}
          >
            <Text style={styles.summarizeBtnText}>Summarize</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => router.navigate({ pathname: '/', params: { continueId: conversation.id } })}
            activeOpacity={0.8}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Summary modal */}
      <Modal visible={summaryVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.summaryOverlay}>
          <TouchableOpacity style={styles.summaryBackdrop} onPress={() => setSummaryVisible(false)} activeOpacity={1} />
          <View style={styles.summarySheet}>
            <View style={styles.summaryHandle} />
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Key Takeaways</Text>
              <TouchableOpacity onPress={() => setSummaryVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.summaryClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.summaryBody} showsVerticalScrollIndicator={false}>
              {summarizing ? (
                <View style={styles.summaryLoading}>
                  <ActivityIndicator color={Colors.teal} />
                  <Text style={styles.summaryLoadingText}>Summarizing…</Text>
                </View>
              ) : (
                <Markdown style={markdownStyles}>{summaryText}</Markdown>
              )}
            </ScrollView>
            {!summarizing && !!summaryText && (
              <TouchableOpacity
                style={styles.summaryShareBtn}
                onPress={() => Share.share({ message: `${conversation.title}\n\nKey Takeaways:\n${summaryText}` })}
                activeOpacity={0.8}
              >
                <Text style={styles.summaryShareText}>Share Summary</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';

  const handleLongPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(content);
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
          <Text style={styles.bubbleTextUser}>{content}</Text>
        ) : (
          <Markdown style={markdownStyles}>{content}</Markdown>
        )}
      </View>
    </TouchableOpacity>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 18, color: Colors.teal, fontWeight: '500' },
  headerCenter: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  editHint: { fontSize: 13, color: Colors.grayDark },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.teal,
    paddingVertical: 2,
    paddingHorizontal: 0,
    minWidth: 80,
  },
  headerDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  shareBtn: { paddingVertical: 4, paddingLeft: 8 },
  shareText: { fontSize: 15, color: Colors.teal, fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  bubbleRow: { alignItems: 'flex-start' },
  bubbleRowUser: { alignItems: 'flex-end' },
  bubble: { maxWidth: '84%', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleUser: { backgroundColor: Colors.teal, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  senderLabel: { fontSize: 11, color: Colors.teal, fontWeight: '700', marginBottom: 4 },
  bubbleTextUser: { fontSize: 16, lineHeight: 23, color: Colors.white },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: Colors.textSecondary, fontSize: 16 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summarizeBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.teal,
    backgroundColor: 'transparent',
  },
  summarizeBtnText: {
    color: Colors.teal,
    fontWeight: '700',
    fontSize: 16,
  },
  continueBtn: {
    flex: 2,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  continueBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  summaryOverlay: { flex: 1, justifyContent: 'flex-end' },
  summaryBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  summarySheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  summaryHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  summaryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  summaryClose: { fontSize: 18, color: Colors.grayDark },
  summaryBody: { paddingHorizontal: 20, paddingTop: 16 },
  summaryLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  summaryLoadingText: { color: Colors.textSecondary, fontSize: 15 },
  summaryShareBtn: {
    marginHorizontal: 20, marginTop: 16,
    borderRadius: 12, padding: 14,
    backgroundColor: Colors.teal, alignItems: 'center',
  },
  summaryShareText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
