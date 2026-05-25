import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  RefreshControl,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import {
  getConversations,
  deleteConversation,
  clearAllHistory,
  getFavorites,
  deleteFavorite,
  type Conversation,
  type Favorite,
} from '../../services/storage';
import { Share } from 'react-native';

function groupConversations(list: Conversation[]): Array<{ title: string; data: Conversation[] }> {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const today: Conversation[] = [];
  const yest: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of list) {
    const d = new Date(conv.date);
    const s = d.toDateString();
    if (s === todayStr) today.push(conv);
    else if (s === yesterdayStr) yest.push(conv);
    else if (d > weekAgo) week.push(conv);
    else older.push(conv);
  }

  const out: Array<{ title: string; data: Conversation[] }> = [];
  if (today.length) out.push({ title: 'Today', data: today });
  if (yest.length) out.push({ title: 'Yesterday', data: yest });
  if (week.length) out.push({ title: 'This Week', data: week });
  if (older.length) out.push({ title: 'Older', data: older });
  return out;
}

const DELETE_WIDTH = 80;

function SwipeRow({
  item,
  onDelete,
  onPress,
}: {
  item: Conversation;
  onDelete: () => void;
  onPress: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const x = Math.max(-DELETE_WIDTH, Math.min(0, g.dx + (isOpen.current ? -DELETE_WIDTH : 0)));
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        const open = isOpen.current ? g.dx > -(DELETE_WIDTH / 2) ? false : true : g.dx < -(DELETE_WIDTH / 2);
        if (open && !isOpen.current) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        isOpen.current = open;
        Animated.spring(translateX, {
          toValue: open ? -DELETE_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  const close = () => {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  const isAnalysis = item.title.startsWith('Analysis:');
  const displayTitle = isAnalysis ? item.title.slice(10) : item.title;
  const msgCount = item.messages.length;

  return (
    <View style={sr.container}>
      <TouchableOpacity style={sr.deleteBtn} onPress={() => { close(); onDelete(); }} activeOpacity={0.8}>
        <Text style={sr.deleteTxt}>Delete</Text>
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={sr.row}
          onPress={() => { if (isOpen.current) { close(); } else { onPress(); } }}
          onLongPress={onDelete}
          activeOpacity={0.8}
        >
          <View style={sr.rowContent}>
            <View style={sr.titleRow}>
              {isAnalysis && <Text style={sr.analysisIcon}>📷</Text>}
              <Text style={sr.rowTitle} numberOfLines={2}>{displayTitle}</Text>
            </View>
            <View style={sr.metaRow}>
              <Text style={sr.rowMeta}>{formatDate(item.date)} · {formatTime(item.date)}</Text>
              <View style={sr.msgBadge}>
                <Text style={sr.msgBadgeText}>{msgCount} msg{msgCount !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
          <Text style={sr.rowArrow}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const sr = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 12 },
  deleteBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  deleteTxt: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  rowContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  analysisIcon: { fontSize: 13, marginTop: 2 },
  rowTitle: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500', lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  rowMeta: { fontSize: 12, color: Colors.grayDark },
  msgBadge: { backgroundColor: Colors.navyMid, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  msgBadgeText: { fontSize: 10, color: Colors.grayDark, fontWeight: '600' },
  rowArrow: { fontSize: 22, color: Colors.grayDark, fontWeight: '300' },
});

export default function HistoryScreen() {
  const [tab, setTab] = useState<'history' | 'saved'>('history');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [convs, favs] = await Promise.all([getConversations(), getFavorites()]);
    setConversations(convs);
    setFavorites(favs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete conversation?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const handleDeleteFavorite = (id: string) => {
    Alert.alert('Remove saved item?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deleteFavorite(id);
          setFavorites(prev => prev.filter(f => f.id !== id));
        },
      },
    ]);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
      )
    : conversations;

  const sections = query.trim()
    ? (filtered.length > 0 ? [{ title: '', data: filtered }] : [])
    : groupConversations(conversations);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {tab === 'history' && conversations.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segment switcher */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'history' && styles.segmentBtnActive]}
          onPress={() => { setTab('history'); setQuery(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'history' && styles.segmentTextActive]}>Conversations</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'saved' && styles.segmentBtnActive]}
          onPress={() => { setTab('saved'); setQuery(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'saved' && styles.segmentTextActive]}>
            Saved{favorites.length > 0 ? ` (${favorites.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'history' ? (
        <>
          {conversations.length > 0 && (
            <View style={styles.searchWrapper}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search conversations…"
                placeholderTextColor={Colors.grayDark}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
          )}
          <SectionList
            sections={sections}
            keyExtractor={c => c.id}
            contentContainerStyle={[styles.list, sections.length === 0 && styles.listEmpty]}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{query.trim() ? 'No results' : 'No conversations yet'}</Text>
                <Text style={styles.emptySub}>
                  {query.trim() ? 'Try a different search term.' : 'Your past chats with AgileIQ will appear here.'}
                </Text>
              </View>
            }
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <SwipeRow
                item={item}
                onDelete={() => handleDelete(item.id)}
                onPress={() => router.push(`/conversation/${item.id}`)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      ) : (
        <SectionList
          sections={favorites.length > 0 ? [{ title: '', data: favorites }] : []}
          keyExtractor={f => f.id}
          contentContainerStyle={[styles.list, favorites.length === 0 && styles.listEmpty]}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No saved responses</Text>
              <Text style={styles.emptySub}>Tap "Save" on any AgileIQ response to bookmark it here.</Text>
            </View>
          }
          renderSectionHeader={() => null}
          renderItem={({ item }: { item: Favorite }) => (
            <TouchableOpacity
              style={styles.favRow}
              onLongPress={() => handleDeleteFavorite(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.favContent}>
                <Text style={styles.favTitle} numberOfLines={1}>{item.conversationTitle}</Text>
                <Text style={styles.favPreview} numberOfLines={3}>{item.content}</Text>
                <Text style={styles.favDate}>
                  {new Date(item.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.favShare}
                onPress={() => Share.share({ message: item.content })}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.favShareText}>Share</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: Colors.text,
  },
  list: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
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
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 0.8,
  },
  segmentBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtnActive: {
    backgroundColor: Colors.tealDim,
    borderColor: Colors.teal,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.grayDark,
  },
  segmentTextActive: {
    color: Colors.tealLight,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  favContent: {
    flex: 1,
  },
  favTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.teal,
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  favPreview: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  favDate: {
    fontSize: 11,
    color: Colors.grayDark,
  },
  favShare: {
    paddingTop: 2,
  },
  favShareText: {
    fontSize: 13,
    color: Colors.teal,
    fontWeight: '600',
  },
});
