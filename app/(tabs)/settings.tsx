import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getApiKey, setApiKey, deleteApiKey } from '../../services/secureStorage';
import { getRemainingQuestions } from '../../services/storage';

export default function SettingsScreen() {
  const [apiKey, setApiKeyState] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(5);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [key, rem] = await Promise.all([getApiKey(), getRemainingQuestions()]);
    setSavedKey(key);
    setRemaining(rem);
    if (key) setApiKeyState(key);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      Alert.alert('Invalid key', 'Anthropic API keys start with "sk-ant-".');
      return;
    }
    setSaving(true);
    await setApiKey(trimmed);
    setSavedKey(trimmed);
    setSaving(false);
    Alert.alert('Saved', 'Your API key has been saved securely.');
  };

  const handleDeleteKey = () => {
    Alert.alert('Remove API key?', 'You will need to re-enter it to use AgileIQ.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteApiKey();
          setSavedKey(null);
          setApiKeyState('');
        },
      },
    ]);
  };

  function maskedKey(key: string): string {
    if (key.length <= 12) return '•'.repeat(key.length);
    return key.slice(0, 10) + '•'.repeat(8) + key.slice(-4);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PLAN</Text>
          <View style={styles.card}>
            <View style={styles.planRow}>
              <View>
                <Text style={styles.planName}>Free</Text>
                <Text style={styles.planDetail}>{remaining} question{remaining !== 1 ? 's' : ''} remaining today</Text>
              </View>
              <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8}>
                <Text style={styles.upgradeText}>Upgrade to Pro</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <View style={styles.proFeatures}>
              <Text style={styles.proLine}>✓  Unlimited questions</Text>
              <Text style={styles.proLine}>✓  Priority response speed</Text>
              <Text style={styles.proLine}>✓  Conversation history sync</Text>
              <Text style={styles.proPrice}>$9.99 / month</Text>
            </View>
          </View>
        </View>

        {/* API Key */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ANTHROPIC API KEY</Text>
          <Text style={styles.sectionHint}>
            Your key is stored securely on-device and never sent to our servers.
            Get one at console.anthropic.com
          </Text>
          <View style={styles.card}>
            {savedKey ? (
              <View style={styles.keyRow}>
                <Text style={styles.maskedKey}>{maskedKey(savedKey)}</Text>
                <TouchableOpacity onPress={handleDeleteKey} activeOpacity={0.7}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.keyInput}
                  value={apiKey}
                  onChangeText={setApiKeyState}
                  placeholder="sk-ant-api03-..."
                  placeholderTextColor={Colors.grayDark}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={[styles.saveBtn, (!apiKey.trim() || saving) && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!apiKey.trim() || saving}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Key'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <Row label="App" value="AgileIQ" />
            <View style={styles.divider} />
            <Row label="Version" value="1.0.0" />
            <View style={styles.divider} />
            <Row label="AI Model" value="Claude Sonnet" />
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
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
  scroll: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  planName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  planDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  upgradeBtn: {
    backgroundColor: Colors.teal,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradeText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  proFeatures: {
    padding: 16,
    gap: 6,
  },
  proLine: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  proPrice: {
    fontSize: 15,
    color: Colors.teal,
    fontWeight: '600',
    marginTop: 6,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  maskedKey: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  removeText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  keyInput: {
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveBtn: {
    margin: 12,
    marginTop: 4,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.navyMid,
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  bottomPad: {
    height: 24,
  },
});
