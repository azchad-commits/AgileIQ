import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  RefreshControl,
  Animated,
  PanResponder,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  getNotes,
  saveNote,
  deleteNote,
  getPinnedIds,
  togglePinConversation,
  type Conversation,
  type Favorite,
  type Note,
} from '../../services/storage';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

function groupConversations(list: Conversation[], pinnedIds: Set<string>): Array<{ title: string; data: Conversation[] }> {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const pinned: Conversation[] = [];
  const today: Conversation[] = [];
  const yest: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of list) {
    if (pinnedIds.has(conv.id)) { pinned.push(conv); continue; }
    const d = new Date(conv.date);
    const s = d.toDateString();
    if (s === todayStr) today.push(conv);
    else if (s === yesterdayStr) yest.push(conv);
    else if (d > weekAgo) week.push(conv);
    else older.push(conv);
  }

  const out: Array<{ title: string; data: Conversation[] }> = [];
  if (pinned.length) out.push({ title: 'Pinned', data: pinned });
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
  onPin,
  onPress,
  isPinned,
}: {
  item: Conversation;
  onDelete: () => void;
  onPin: () => void;
  onPress: () => void;
  isPinned: boolean;
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
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(displayTitle, undefined, [
              { text: isPinned ? 'Unpin' : 'Pin to Top', onPress: onPin },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.8}
        >
          <View style={sr.rowContent}>
            <View style={sr.titleRow}>
              {isPinned && <Text style={sr.analysisIcon}>📌</Text>}
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

function SwipeNoteRow({
  item,
  onDelete,
  onPress,
}: {
  item: Note;
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
        if (open && !isOpen.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        isOpen.current = open;
        Animated.spring(translateX, { toValue: open ? -DELETE_WIDTH : 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  const close = () => {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  return (
    <View style={sr.container}>
      <TouchableOpacity style={sr.deleteBtn} onPress={() => { close(); onDelete(); }} activeOpacity={0.8}>
        <Text style={sr.deleteTxt}>Delete</Text>
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={sr.row}
          onPress={() => { if (isOpen.current) { close(); } else { onPress(); } }}
          activeOpacity={0.8}
        >
          <View style={sr.rowContent}>
            <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.notePreview} numberOfLines={2}>{item.content}</Text>
            <Text style={styles.noteDate}>
              {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <Text style={sr.rowArrow}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function NoteEditor({
  note,
  onSave,
  onClose,
}: {
  note: Partial<Note> | null;
  onSave: (n: Note) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');

  const handleSave = async () => {
    const trimTitle = title.trim();
    const trimContent = content.trim();
    if (!trimContent) { onClose(); return; }
    const now = new Date().toISOString();
    const saved: Note = {
      id: note?.id ?? Date.now().toString(),
      title: trimTitle || trimContent.slice(0, 40),
      content: trimContent,
      createdAt: note?.createdAt ?? now,
      updatedAt: now,
    };
    await saveNote(saved);
    onSave(saved);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ne.container}>
        <View style={ne.header}>
          <TouchableOpacity onPress={onClose} style={ne.headerBtn} activeOpacity={0.7}>
            <Text style={ne.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={ne.headerTitle}>{note?.id ? 'Edit Note' : 'New Note'}</Text>
          <TouchableOpacity onPress={handleSave} style={ne.headerBtn} activeOpacity={0.7}>
            <Text style={ne.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ne.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={ne.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor={Colors.grayDark}
            maxLength={80}
            returnKeyType="next"
          />
          <View style={ne.divider} />
          <TextInput
            style={ne.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="Write your note…"
            placeholderTextColor={Colors.grayDark}
            multiline
            autoFocus={!note?.id}
            maxLength={4000}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ne = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBtn: { minWidth: 60 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cancelText: { fontSize: 16, color: Colors.grayDark },
  saveText: { fontSize: 16, color: Colors.teal, fontWeight: '700', textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  body: { padding: 16, paddingBottom: 120 },
  titleInput: {
    fontSize: 20, fontWeight: '700', color: Colors.text,
    paddingVertical: 8, marginBottom: 4,
  },
  contentInput: {
    fontSize: 16, color: Colors.text, lineHeight: 24,
    paddingTop: 12, minHeight: 300,
  },
});

export default function HistoryScreen() {
  const [tab, setTab] = useState<'history' | 'saved' | 'notes'>('history');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [savedQuery, setSavedQuery] = useState('');
  const [savedCopied, setSavedCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNote, setEditingNote] = useState<Partial<Note> | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [undoItem, setUndoItem] = useState<{ type: 'conv' | 'note'; id: string; snapshot: Conversation | Note } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [convs, favs, nts, pins] = await Promise.all([getConversations(), getFavorites(), getNotes(), getPinnedIds()]);
    setConversations(convs);
    setFavorites(favs);
    setNotes(nts);
    setPinnedIds(new Set(pins));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const commitPendingDelete = () => {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
  };

  const scheduleDelete = (type: 'conv' | 'note', id: string, snapshot: Conversation | Note) => {
    commitPendingDelete();
    setUndoItem({ type, id, snapshot });
    undoTimerRef.current = setTimeout(() => {
      if (type === 'conv') deleteConversation(id);
      else deleteNote(id);
      setUndoItem(null);
      undoTimerRef.current = null;
    }, 3500);
  };

  const handleDelete = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConversations(prev => prev.filter(c => c.id !== id));
    scheduleDelete('conv', id, conv);
  };

  const handlePin = async (id: string) => {
    const nowPinned = await togglePinConversation(id);
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (nowPinned) next.add(id); else next.delete(id);
      return next;
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUndoDelete = () => {
    if (!undoItem || !undoTimerRef.current) return;
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    if (undoItem.type === 'conv') {
      const conv = undoItem.snapshot as Conversation;
      setConversations(prev => [conv, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else {
      const note = undoItem.snapshot as Note;
      setNotes(prev => [note, ...prev].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    }
    setUndoItem(null);
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

  const handleDeleteNote = async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotes(prev => prev.filter(n => n.id !== id));
    scheduleDelete('note', id, note);
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

  const handleCopySaved = async (id: string, content: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(content);
    setSavedCopied(id);
    setTimeout(() => setSavedCopied(null), 1500);
  };

  const sq = savedQuery.trim().toLowerCase();
  const filteredFavorites = sq
    ? favorites.filter(f => f.content.toLowerCase().includes(sq) || f.conversationTitle.toLowerCase().includes(sq))
    : favorites;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
      )
    : conversations;

  const sections = query.trim()
    ? (filtered.length > 0 ? [{ title: '', data: filtered }] : [])
    : groupConversations(conversations, pinnedIds);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {tab === 'history' && conversations.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
        {tab === 'notes' && (
          <TouchableOpacity onPress={() => setEditingNote({})} activeOpacity={0.7} style={styles.newNoteBtn}>
            <Text style={styles.newNoteBtnText}>+ Note</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segment switcher */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'history' && styles.segmentBtnActive]}
          onPress={() => { setTab('history'); setQuery(''); setSavedQuery(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'history' && styles.segmentTextActive]}>Chats</Text>
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
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'notes' && styles.segmentBtnActive]}
          onPress={() => { setTab('notes'); setQuery(''); setSavedQuery(''); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'notes' && styles.segmentTextActive]}>
            Notes{notes.length > 0 ? ` (${notes.length})` : ''}
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
                isPinned={pinnedIds.has(item.id)}
                onDelete={() => handleDelete(item.id)}
                onPin={() => handlePin(item.id)}
                onPress={() => router.push(`/conversation/${item.id}`)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      ) : tab === 'saved' ? (
        <>
          {favorites.length > 0 && (
            <View style={styles.searchWrapper}>
              <TextInput
                style={styles.searchInput}
                value={savedQuery}
                onChangeText={setSavedQuery}
                placeholder="Search saved responses…"
                placeholderTextColor={Colors.grayDark}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
          )}
          <SectionList
            sections={filteredFavorites.length > 0 ? [{ title: '', data: filteredFavorites }] : []}
            keyExtractor={f => f.id}
            contentContainerStyle={[styles.list, filteredFavorites.length === 0 && styles.listEmpty]}
            stickySectionHeadersEnabled={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{savedQuery.trim() ? 'No results' : 'No saved responses'}</Text>
                <Text style={styles.emptySub}>
                  {savedQuery.trim() ? 'Try a different search term.' : 'Tap "Save" on any AgileIQ response to bookmark it here.'}
                </Text>
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
                <View style={styles.favActions}>
                  <TouchableOpacity
                    style={[styles.favActionBtn, styles.favCopyBtn, savedCopied === item.id && styles.favCopyBtnDone]}
                    onPress={() => handleCopySaved(item.id, item.content)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.favActionText, savedCopied === item.id && styles.favCopyTextDone]}>
                      {savedCopied === item.id ? '✓' : '⎘'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.favActionBtn}
                    onPress={() => Share.share({ message: item.content })}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.favShareText}>↑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      ) : (
        /* Notes tab */
        <>
          {notes.length === 0 ? (
            <View style={[styles.list, styles.listEmpty, styles.empty]}>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySub}>Tap "+ Note" to jot down sprint notes, impediments, or coaching insights.</Text>
              <TouchableOpacity style={styles.newNoteEmptyBtn} onPress={() => setEditingNote({})} activeOpacity={0.8}>
                <Text style={styles.newNoteEmptyBtnText}>+ New Note</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={notes}
              keyExtractor={n => n.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <SwipeNoteRow
                  item={item}
                  onDelete={() => handleDeleteNote(item.id)}
                  onPress={() => setEditingNote(item)}
                />
              )}
            />
          )}
        </>
      )}

      {undoItem !== null && (
        <View style={styles.undoBar} pointerEvents="box-none">
          <View style={styles.undoContent}>
            <Text style={styles.undoText}>
              {undoItem.type === 'conv' ? 'Conversation deleted' : 'Note deleted'}
            </Text>
            <TouchableOpacity onPress={handleUndoDelete} activeOpacity={0.7} style={styles.undoBtn}>
              <Text style={styles.undoBtnText}>Undo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {editingNote !== null && (
        <NoteEditor
          note={editingNote}
          onSave={saved => {
            setNotes(prev => {
              const idx = prev.findIndex(n => n.id === saved.id);
              if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
              return [saved, ...prev];
            });
            setEditingNote(null);
          }}
          onClose={() => setEditingNote(null)}
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
  favActions: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    paddingLeft: 4,
  },
  favActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.navyMid,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favCopyBtn: {
    borderColor: Colors.teal,
    backgroundColor: Colors.tealDim,
  },
  favCopyBtnDone: {
    backgroundColor: Colors.teal,
  },
  favActionText: {
    fontSize: 14,
    color: Colors.teal,
    fontWeight: '600',
  },
  favCopyTextDone: {
    color: Colors.white,
  },
  favShareText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  newNoteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  newNoteBtnText: { fontSize: 12, color: Colors.teal, fontWeight: '600' },
  newNoteEmptyBtn: {
    marginTop: 20,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  newNoteEmptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  noteContent: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  notePreview: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 5 },
  noteDate: { fontSize: 11, color: Colors.grayDark },
  noteArrow: { fontSize: 22, color: Colors.grayDark, fontWeight: '300' },
  undoBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 50,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  undoText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.tealDim,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  undoBtnText: { fontSize: 13, color: Colors.tealLight, fontWeight: '700' },
});
