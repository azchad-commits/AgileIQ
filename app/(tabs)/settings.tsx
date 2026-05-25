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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { getApiKey, setApiKey, deleteApiKey } from '../../services/secureStorage';
import { getUserContext, setUserContext as saveUserContext, getIsPro, FREE_TIER_LIMIT, PRO_TIER_LIMIT } from '../../services/storage';
import { syncProStatus, presentProPaywall, restorePurchases } from '../../services/revenueCat';
import { OnboardingModal } from '../../components/OnboardingModal';

export default function SettingsScreen() {
  const [apiKey, setApiKeyState] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'valid' | string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [userContext, setUserContext] = useState('');
  const [isPro, setIsProState] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    const [key, pro] = await Promise.all([getApiKey(), syncProStatus()]);
    setSavedKey(key);
    if (key) setApiKeyState(key);
    setTestResult(null);
    setIsProState(pro);
    const ctx = await getUserContext();
    setUserContext(ctx);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const purchased = await presentProPaywall();
      if (purchased) setIsProState(true);
    } catch (e: any) {
      Alert.alert('Purchase failed', e.message ?? 'Something went wrong.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      setIsProState(restored);
      Alert.alert(restored ? 'Pro Restored' : 'Nothing to Restore', restored ? 'Your Pro subscription is active.' : 'No previous purchase found for this Apple ID.');
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  const handleTestKey = async () => {
    if (!savedKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': savedKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (res.ok) {
        setTestResult('valid');
      } else {
        const err = await res.json().catch(() => ({}));
        const type: string = (err as any)?.error?.type ?? '';
        if (type === 'authentication_error' || res.status === 401) {
          setTestResult('Invalid API key. Double-check your key.');
        } else {
          setTestResult((err as any)?.error?.message ?? `Error ${res.status}`);
        }
      }
    } catch {
      setTestResult('Network error. Check your connection.');
    } finally {
      setTesting(false);
    }
  };

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
    setTestResult(null);
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
          setTestResult(null);
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
          <Text style={styles.sectionLabel}>YOUR PLAN</Text>
          <View style={styles.card}>
            {savedKey ? (
              <View style={styles.planRow}>
                <View>
                  <Text style={styles.planTitle}>BYOK — Unlimited ✦</Text>
                  <Text style={styles.planSub}>Using your own Anthropic API key</Text>
                </View>
              </View>
            ) : isPro ? (
              <>
                <View style={styles.planRow}>
                  <View>
                    <Text style={styles.planTitle}>AgileIQ Pro ✦</Text>
                    <Text style={styles.planSub}>{PRO_TIER_LIMIT} questions/day · $9.99/month</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.planAction} onPress={handleRestore} disabled={restoring} activeOpacity={0.7}>
                  {restoring
                    ? <ActivityIndicator size="small" color={Colors.teal} />
                    : <Text style={styles.planActionText}>Restore Purchases</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.planRow}>
                  <View>
                    <Text style={styles.planTitle}>Free Plan</Text>
                    <Text style={styles.planSub}>{FREE_TIER_LIMIT} questions/day</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={upgrading} activeOpacity={0.85}>
                  {upgrading
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={styles.upgradeBtnText}>Upgrade to Pro — $9.99/month</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.planAction} onPress={handleRestore} disabled={restoring} activeOpacity={0.7}>
                  {restoring
                    ? <ActivityIndicator size="small" color={Colors.teal} />
                    : <Text style={styles.planActionText}>Restore Purchases</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* BYOK — optional */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BRING YOUR OWN API KEY (OPTIONAL)</Text>
          <Text style={styles.sectionHint}>
            Enter your own Anthropic API key for unlimited questions with no subscription.
            Your key is stored securely on-device only.
          </Text>
          <View style={styles.card}>
            {savedKey ? (
              <>
                <View style={styles.keyRow}>
                  <Text style={styles.maskedKey}>{maskedKey(savedKey)}</Text>
                  <View style={styles.keyActions}>
                    <TouchableOpacity
                      onPress={handleTestKey}
                      disabled={testing}
                      activeOpacity={0.7}
                      style={styles.testBtn}
                    >
                      {testing
                        ? <ActivityIndicator size="small" color={Colors.teal} />
                        : <Text style={styles.testText}>Test</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDeleteKey} activeOpacity={0.7}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {testResult && (
                  <View style={[styles.testBanner, testResult === 'valid' ? styles.testBannerOk : styles.testBannerErr]}>
                    <Text style={[styles.testBannerText, testResult === 'valid' ? styles.testBannerTextOk : styles.testBannerTextErr]}>
                      {testResult === 'valid' ? '✓  API key is working' : `✗  ${testResult}`}
                    </Text>
                  </View>
                )}
              </>
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

        {/* Coaching Context */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COACHING CONTEXT</Text>
          <Text style={styles.sectionHint}>
            Describe your role and team so AgileIQ tailors every response to your situation.
          </Text>
          <View style={styles.card}>
            <TextInput
              style={styles.contextInput}
              value={userContext}
              onChangeText={setUserContext}
              onBlur={() => saveUserContext(userContext.trim())}
              placeholder={'e.g. Scrum Master at a 60-person SaaS company, 2-week sprints, teams of 6–8, using Jira…'}
              placeholderTextColor={Colors.grayDark}
              multiline
              maxLength={300}
            />
            <Text style={styles.contextCount}>{userContext.length}/300</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <Row label="App" value="AgileIQ" />
            <View style={styles.divider} />
            <Row label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
            <View style={styles.divider} />
            <Row label="AI Model" value="Claude Sonnet" />
            <View style={styles.divider} />
            <TouchableOpacity style={styles.infoRow} onPress={() => setShowIntro(true)} activeOpacity={0.7}>
              <Text style={styles.infoLabel}>How to Use</Text>
              <Text style={styles.infoChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <OnboardingModal visible={showIntro} onDismiss={() => setShowIntro(false)} />
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  planTitle: { fontSize: 16, fontWeight: '700', color: Colors.teal, marginBottom: 2 },
  planSub: { fontSize: 13, color: Colors.textSecondary },
  upgradeBtn: {
    margin: 12,
    marginTop: 0,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  upgradeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  planAction: { paddingVertical: 14, alignItems: 'center' },
  planActionText: { fontSize: 14, color: Colors.teal, fontWeight: '500' },
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
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  testBtn: {
    minWidth: 36,
    alignItems: 'center',
  },
  testText: {
    fontSize: 14,
    color: Colors.teal,
    fontWeight: '600',
  },
  removeText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  testBanner: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  testBannerOk: {
    backgroundColor: Colors.tealDim,
    borderColor: Colors.teal,
  },
  testBannerErr: {
    backgroundColor: Colors.errorDim,
    borderColor: Colors.error,
  },
  testBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  testBannerTextOk: {
    color: Colors.tealLight,
  },
  testBannerTextErr: {
    color: Colors.error,
  },
  keyInput: {
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contextInput: {
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    minHeight: 88,
    textAlignVertical: 'top',
    lineHeight: 21,
  },
  contextCount: {
    fontSize: 11,
    color: Colors.grayDark,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 10,
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
  infoChevron: {
    fontSize: 20,
    color: Colors.grayDark,
    fontWeight: '300',
  },
  bottomPad: {
    height: 24,
  },
});
