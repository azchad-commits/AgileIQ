import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { getApiKey } from '../../services/secureStorage';
import { saveConversation } from '../../services/storage';
import { friendlyApiError } from '../../services/apiErrors';

const ANALYSIS_SYSTEM_PROMPT =
  'You are AgileIQ, an expert Agile coach. The user has shared a screenshot — a Jira board, project plan, sprint roadmap, backlog, or team report. Analyze it and provide specific, actionable coaching recommendations. Reference concrete details from the image. Use headers to organize your response.';

const QUICK_PROMPTS = [
  'Identify Agile anti-patterns and how to fix them',
  'Assess sprint health and recommend improvements',
  'Review prioritization and suggest a better ordering',
  'What are the biggest risks in this plan?',
  'How can we improve team flow and reduce bottlenecks?',
];

const HOW_TO_TIPS: Array<[string, string, string]> = [
  ['📋', 'Jira board screenshot', 'Screenshot your sprint or backlog view'],
  ['🗂️', 'Kanban board', 'Screenshot your kanban columns and cards'],
  ['📊', 'Roadmap or timeline', 'Screenshot your roadmap slide or view'],
  ['📌', 'Retrospective board', 'Screenshot your retro or planning board'],
];

const MAX_IMAGE_B64_CHARS = 7_000_000; // ~5 MB decoded

interface PickedImage {
  name: string;
  base64: string;
  mimeType: string;
  previewUri: string;
}

async function pickFromSource(source: 'library' | 'camera'): Promise<PickedImage | null> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return null;
    const asset = res.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'Could not read photo.'); return null; }
    if (asset.base64.length > MAX_IMAGE_B64_CHARS) { Alert.alert('Image too large', 'Please use an image under 5 MB.'); return null; }
    return { name: `photo_${Date.now()}.jpg`, base64: asset.base64, mimeType: 'image/jpeg', previewUri: asset.uri };
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, base64: true, quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return null;
    const asset = res.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'Could not read image.'); return null; }
    if (asset.base64.length > MAX_IMAGE_B64_CHARS) { Alert.alert('Image too large', 'Please use an image under 5 MB.'); return null; }
    return { name: asset.fileName ?? 'screenshot.jpg', base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg', previewUri: asset.uri };
  }
}

export default function AnalyzeScreen() {
  const [image, setImage] = useState<PickedImage | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedConversationId, setSavedConversationId] = useState<string | null>(null);
  const [showResultView, setShowResultView] = useState(false);

  const reset = useCallback(() => {
    setImage(null);
    setPrompt('');
    setResult(null);
    setError(null);
    setSavedConversationId(null);
    setShowResultView(false);
  }, []);

  const handlePick = useCallback(async (source: 'library' | 'camera') => {
    const picked = await pickFromSource(source);
    if (!picked) return;
    setImage(picked);
    setResult(null);
    setError(null);
    setSavedConversationId(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!image) return;
    const finalPrompt = prompt.trim() || 'Analyze this and provide specific Agile coaching recommendations.';

    const apiKey = await getApiKey();
    if (!apiKey) {
      setError('Add your Anthropic API key in Settings to get started.');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);

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
          max_tokens: 2048,
          system: ANALYSIS_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
              },
              { type: 'text', text: finalPrompt },
            ],
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? `API error ${res.status}`);
      }

      const data = await res.json();
      const text: string = data.content?.[0]?.text ?? '';
      setResult(text);
      setShowResultView(true);

      const convId = Date.now().toString();
      await saveConversation({
        id: convId,
        title: `Analysis: ${image.name.slice(0, 50)}`,
        date: new Date().toISOString(),
        messages: [
          { role: 'user', content: `[Screenshot: ${image.name}]\n\n${finalPrompt}` },
          { role: 'assistant', content: text },
        ],
      });
      setSavedConversationId(convId);

    } catch (e: unknown) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [image, prompt]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(result);
    Alert.alert('Copied', 'Analysis copied to clipboard.');
  }, [result]);

  // ── Result phase ─────────────────────────────────────────────
  if (showResultView) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} activeOpacity={0.7} disabled={loading}>
            <Text style={[styles.backText, loading && styles.backTextDisabled]}>‹ New Analysis</Text>
          </TouchableOpacity>
          <Text style={styles.fileBadge} numberOfLines={1}>{image?.name}</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.resultScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading && (
            <View style={styles.reAnalyzeLoading}>
              <ActivityIndicator size="small" color={Colors.teal} />
              <Text style={styles.reAnalyzeLoadingText}>Re-analyzing…</Text>
            </View>
          )}
          <TouchableOpacity onLongPress={handleCopyResult} activeOpacity={0.92}>
            <View style={styles.resultCard}>
              {image && (
                <View style={styles.resultThumbRow}>
                  <Image source={{ uri: image.previewUri }} style={styles.resultThumb} resizeMode="cover" />
                  <Text style={styles.resultThumbName} numberOfLines={2}>{image.name}</Text>
                </View>
              )}
              <Text style={styles.resultLabel}>AgileIQ Analysis</Text>
              <Markdown style={markdownStyles}>{result ?? ''}</Markdown>
            </View>
          </TouchableOpacity>
          <Text style={styles.copyHint}>Long-press to copy</Text>
          {savedConversationId && (
            <TouchableOpacity
              style={styles.discussBtn}
              onPress={() => router.navigate({ pathname: '/', params: { continueId: savedConversationId } })}
              activeOpacity={0.85}
            >
              <Text style={styles.discussBtnText}>Discuss in Chat</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.sectionLabel, styles.reAnalyzeSectionLabel]}>RE-ANALYZE</Text>
          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask a different question about this image…"
            placeholderTextColor={Colors.grayDark}
            multiline
            maxLength={500}
          />
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
            onPress={analyze}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.analyzeBtnText}>Re-Analyze</Text>
            }
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Pick / Ready phase ────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analyze</Text>
        <Text style={styles.headerSub}>Screenshot your board for Agile coaching</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pick buttons */}
        {!image && (
          <>
            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={() => handlePick('library')} activeOpacity={0.8}>
                <Text style={styles.pickIcon}>🖼️</Text>
                <Text style={styles.pickBtnTitle}>Library</Text>
                <Text style={styles.pickBtnSub}>Pick from Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={() => handlePick('camera')} activeOpacity={0.8}>
                <Text style={styles.pickIcon}>📷</Text>
                <Text style={styles.pickBtnTitle}>Camera</Text>
                <Text style={styles.pickBtnSub}>Take a photo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>WHAT TO UPLOAD</Text>
            {HOW_TO_TIPS.map(([icon, title, sub]) => (
              <View key={title} style={styles.tipRow}>
                <Text style={styles.tipIcon}>{icon}</Text>
                <View style={styles.tipText}>
                  <Text style={styles.tipTitle}>{title}</Text>
                  <Text style={styles.tipSub}>{sub}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Image preview */}
        {!!image && (
          <View style={styles.previewCard}>
            <Image source={{ uri: image.previewUri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={2}>{image.name}</Text>
            </View>
            <TouchableOpacity onPress={reset} style={styles.removeBtn} activeOpacity={0.7}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick prompts + input */}
        {!!image && (
          <>
            <Text style={styles.sectionLabel}>QUICK ANALYSIS</Text>
            {QUICK_PROMPTS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, prompt === p && styles.chipActive]}
                onPress={() => setPrompt(prev => prev === p ? '' : p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, prompt === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.sectionLabel}>OR ASK SOMETHING SPECIFIC</Text>
            <TextInput
              style={styles.promptInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g. What's the biggest blocker to flow?"
              placeholderTextColor={Colors.grayDark}
              multiline
              maxLength={500}
            />

            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={analyze} style={styles.retryBtn} activeOpacity={0.8}>
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
              onPress={analyze}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.analyzeBtnText}>Analyze with AgileIQ</Text>
              }
            </TouchableOpacity>

            {loading && (
              <Text style={styles.loadingHint}>Analyzing… this may take 15–30 seconds</Text>
            )}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: Colors.text, fontSize: 15, lineHeight: 22, backgroundColor: 'transparent' } as any,
  paragraph: { marginTop: 0, marginBottom: 8, color: Colors.text } as any,
  heading1: { color: Colors.white, fontSize: 18, fontWeight: '700', marginVertical: 8 } as any,
  heading2: { color: Colors.white, fontSize: 16, fontWeight: '700', marginVertical: 6 } as any,
  heading3: { color: Colors.teal, fontSize: 15, fontWeight: '700', marginVertical: 4 } as any,
  strong: { fontWeight: '700', color: Colors.white } as any,
  em: { fontStyle: 'italic' } as any,
  bullet_list: { marginLeft: 0 } as any,
  ordered_list: { marginLeft: 0 } as any,
  list_item: { color: Colors.text, fontSize: 15, lineHeight: 22 } as any,
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  backText: { fontSize: 18, color: Colors.teal, fontWeight: '500' },
  fileBadge: { fontSize: 12, color: Colors.grayDark, marginTop: 4 },
  scroll: { padding: 16 },
  resultScroll: { padding: 16 },
  pickRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  pickBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  pickIcon: { fontSize: 34 },
  pickBtnTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  pickBtnSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  tipIcon: { fontSize: 20, marginTop: 1 },
  tipText: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 1 },
  tipSub: { fontSize: 13, color: Colors.textSecondary },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 24,
    gap: 12,
    padding: 12,
  },
  previewImage: { width: 72, height: 72, borderRadius: 8 },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 16, color: Colors.grayDark, fontWeight: '600' },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  chipActive: { borderColor: Colors.teal, backgroundColor: Colors.teal + '18' },
  chipText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  chipTextActive: { color: Colors.teal, fontWeight: '600' },
  promptInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  errorBanner: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: Colors.errorDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: { color: Colors.error, fontSize: 14, lineHeight: 20 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { color: Colors.teal, fontSize: 13, fontWeight: '600' },
  analyzeBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  analyzeBtnDisabled: { backgroundColor: Colors.navyMid },
  analyzeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  loadingHint: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.grayDark,
    marginTop: 12,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  resultThumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultThumb: { width: 48, height: 48, borderRadius: 8 },
  resultThumbName: { flex: 1, fontSize: 12, color: Colors.grayDark, lineHeight: 18 },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
    marginBottom: 14,
  },
  backTextDisabled: {
    opacity: 0.4,
  },
  reAnalyzeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reAnalyzeLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  reAnalyzeSectionLabel: {
    marginTop: 24,
  },
  copyHint: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.grayDark,
    marginTop: 12,
  },
  discussBtn: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.teal,
    padding: 14,
    alignItems: 'center',
  },
  discussBtnText: {
    color: Colors.teal,
    fontWeight: '700',
    fontSize: 15,
  },
  bottomPad: { height: 32 },
});
