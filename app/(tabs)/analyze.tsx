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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { getApiKey } from '../../services/secureStorage';
import { getIsPro, checkAndIncrementDailyCount, saveConversation } from '../../services/storage';
import { presentProPaywall } from '../../services/revenueCat';

const ANALYSIS_SYSTEM_PROMPT =
  'You are AgileIQ, an expert Agile coach. The user has shared a document or image — a Jira board, project plan, sprint roadmap, backlog, or team report. Analyze it and provide specific, actionable coaching recommendations. Reference concrete details from the document. Use headers to organize your response.';

const QUICK_PROMPTS = [
  'Identify Agile anti-patterns and how to fix them',
  'Assess sprint health and recommend improvements',
  'Review prioritization and suggest a better ordering',
  'What are the biggest risks in this plan?',
  'How can we improve team flow and reduce bottlenecks?',
];

const HOW_TO_TIPS: Array<[string, string, string]> = [
  ['📋', 'Jira CSV export', 'File → Export issues → CSV'],
  ['🗂️', 'Board screenshot', 'Screenshot your sprint or kanban board'],
  ['📊', 'Sprint report / PDF', 'Sprint review or retrospective doc'],
  ['📌', 'Roadmap image', 'Screenshot timeline or roadmap slide'],
];

const MAX_IMAGE_B64_CHARS = 7_000_000; // ~5 MB decoded
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_CSV_CHARS = 80_000;

interface PickedFile {
  name: string;
  size?: number;
  type: 'image' | 'pdf' | 'csv';
  base64?: string;
  textContent?: string;
  mimeType: string;
  previewUri?: string;
}

export default function AnalyzeScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPrompt('');
    setResult(null);
    setError(null);
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      base64: true,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) { Alert.alert('Error', 'Could not read image.'); return; }
    if (asset.base64.length > MAX_IMAGE_B64_CHARS) {
      Alert.alert('Image too large', 'Please use an image under 5 MB.');
      return;
    }
    setFile({
      name: asset.fileName ?? 'image.jpg',
      type: 'image',
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
      previewUri: asset.uri,
    });
    setResult(null);
    setError(null);
  }, []);

  const pickDocument = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/csv',
        'text/plain',
        'text/comma-separated-values',
        'public.comma-separated-values-text',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const name = asset.name.toLowerCase();
    const mime = asset.mimeType ?? '';
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    const isCsv = mime.includes('csv') || name.endsWith('.csv') || name.endsWith('.txt');

    if (!isPdf && !isCsv) {
      Alert.alert('Unsupported file', 'Please pick a PDF, CSV, or TXT file.');
      return;
    }

    if (isPdf) {
      if (asset.size && asset.size > MAX_PDF_BYTES) {
        Alert.alert('PDF too large', 'Please use a PDF under 10 MB.');
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setFile({ name: asset.name, size: asset.size, type: 'pdf', base64, mimeType: 'application/pdf' });
    } else {
      let text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (text.length > MAX_CSV_CHARS) {
        text = text.slice(0, MAX_CSV_CHARS);
        Alert.alert('File truncated', 'Only the first 80,000 characters will be analyzed.');
      }
      setFile({ name: asset.name, size: asset.size, type: 'csv', textContent: text, mimeType: mime });
    }
    setResult(null);
    setError(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!file) return;
    const finalPrompt = prompt.trim() || 'Analyze this and provide specific Agile coaching recommendations.';

    const apiKey = await getApiKey();
    if (!apiKey) {
      setError('Add your Anthropic API key in Settings to get started.');
      return;
    }

    const isPro = await getIsPro();
    if (!isPro) {
      const allowed = await checkAndIncrementDailyCount();
      if (!allowed) {
        const upgraded = await presentProPaywall();
        if (!upgraded) return;
      }
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);

    const userContent: object[] = [];

    if (file.type === 'image') {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.base64 },
      });
    } else if (file.type === 'pdf') {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
      });
    } else {
      userContent.push({ type: 'text', text: `File: ${file.name}\n\n${file.textContent}` });
    }

    userContent.push({ type: 'text', text: finalPrompt });

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: ANALYSIS_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? `API error ${res.status}`);
      }

      const data = await res.json();
      const text: string = data.content?.[0]?.text ?? '';
      setResult(text);

      await saveConversation({
        id: Date.now().toString(),
        title: `Analysis: ${file.name.slice(0, 50)}`,
        date: new Date().toISOString(),
        messages: [
          { role: 'user', content: `[Uploaded: ${file.name}]\n\n${finalPrompt}` },
          { role: 'assistant', content: text },
        ],
      });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      const isOffline = msg.toLowerCase().includes('network request failed')
        || msg.toLowerCase().includes('failed to fetch');
      setError(isOffline ? 'No internet connection. Check your network and try again.' : msg);
    } finally {
      setLoading(false);
    }
  }, [file, prompt]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(result);
    Alert.alert('Copied', 'Analysis copied to clipboard.');
  }, [result]);

  // ── Result phase ─────────────────────────────────────────────
  if (result) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} activeOpacity={0.7}>
            <Text style={styles.backText}>‹ New Analysis</Text>
          </TouchableOpacity>
          <Text style={styles.fileBadge} numberOfLines={1}>{file?.name}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onLongPress={handleCopyResult} activeOpacity={0.92}>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>AgileIQ Analysis</Text>
              <Markdown style={markdownStyles}>{result}</Markdown>
            </View>
          </TouchableOpacity>
          <Text style={styles.copyHint}>Long-press to copy</Text>
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
        <Text style={styles.headerSub}>Upload a file for Agile coaching</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Picker buttons */}
        {!file && (
          <>
            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.8}>
                <Text style={styles.pickIcon}>🖼️</Text>
                <Text style={styles.pickBtnTitle}>Screenshot</Text>
                <Text style={styles.pickBtnSub}>Jira board, roadmap,{'\n'}kanban, slide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={pickDocument} activeOpacity={0.8}>
                <Text style={styles.pickIcon}>📄</Text>
                <Text style={styles.pickBtnTitle}>Document</Text>
                <Text style={styles.pickBtnSub}>PDF or CSV export{'\n'}from Jira / tools</Text>
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

        {/* File preview */}
        {!!file && (
          <View style={styles.previewCard}>
            {file.type === 'image' && file.previewUri ? (
              <Image source={{ uri: file.previewUri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewDocIcon}>
                <Text style={styles.previewDocEmoji}>{file.type === 'pdf' ? '📄' : '📊'}</Text>
              </View>
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={2}>{file.name}</Text>
              {!!file.size && (
                <Text style={styles.previewSize}>{(file.size / 1024).toFixed(0)} KB</Text>
              )}
            </View>
            <TouchableOpacity onPress={reset} style={styles.removeBtn} activeOpacity={0.7}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick prompts + input */}
        {!!file && (
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
  fileBadge: {
    fontSize: 12,
    color: Colors.grayDark,
    marginTop: 4,
  },
  scroll: { padding: 16 },
  resultScroll: { padding: 16 },
  pickRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  pickBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  pickIcon: { fontSize: 32 },
  pickBtnTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  pickBtnSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17 },
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
  previewImage: { width: 64, height: 64, borderRadius: 8 },
  previewDocIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDocEmoji: { fontSize: 28 },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  previewSize: { fontSize: 12, color: Colors.grayDark, marginTop: 2 },
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
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
    marginBottom: 14,
  },
  copyHint: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.grayDark,
    marginTop: 12,
  },
  bottomPad: { height: 32 },
});
