import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { getConversations, type Conversation } from '../../services/storage';

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
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
          <Text style={styles.headerTitle} numberOfLines={1}>{conversation.title}</Text>
          <Text style={styles.headerDate}>{formattedDate}</Text>
        </View>
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  headerDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
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
});
