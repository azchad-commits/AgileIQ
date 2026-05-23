import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import {
  getConversations,
  deleteConversation,
  clearAllHistory,
  type Conversation,
} from '../../services/storage';

export default function HistoryScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const load = useCallback(async () => {
    const data = await getConversations();
    setConversations(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: string) => {
    Alert.alert('Delete conversation?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteConversation(id);
          load();
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (conversations.length === 0) return;
    Alert.alert('Clear all history?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearAllHistory();
          setConversations([]);
        },
      },
    ]);
  };

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {conversations.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={conversations}
        keyExtractor={c => c.id}
        contentContainerStyle={[styles.list, conversations.length === 0 && styles.listEmpty]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>Your past chats with AgileIQ will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/conversation/${item.id}`)}
            onLongPress={() => handleDelete(item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {formatDate(item.date)} · {formatTime(item.date)} · {item.messages.length / 2 | 0} exchange{item.messages.length !== 2 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
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
    color: Colors.text,
    letterSpacing: -0.3,
  },
  clearText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  list: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    lineHeight: 21,
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 12,
    color: Colors.grayDark,
  },
  rowArrow: {
    fontSize: 22,
    color: Colors.grayDark,
    fontWeight: '300',
  },
  separator: {
    height: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
