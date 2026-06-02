import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../constants/urls';
import { purchasePro, restorePurchases } from '../services/revenueCat';
import { completePaywall } from '../services/paywallBridge';
import Purchases from 'react-native-purchases';

const FEATURES = [
  { icon: 'infinite-outline', text: 'Unlimited AI coaching questions' },
  { icon: 'school-outline', text: 'Expert Agile, Scrum & SAFe guidance' },
  { icon: 'scan-outline', text: 'Board & roadmap analysis with vision AI' },
  { icon: 'grid-outline', text: 'All topics, frameworks & ceremonies' },
  { icon: 'heart-outline', text: 'Support independent development' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const [priceString, setPriceString] = useState<string>('$9.99/month');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    Purchases.getOfferings()
      .then((o) => {
        const price = o.current?.monthly?.product?.priceString;
        if (price) setPriceString(`${price}/month`);
      })
      .catch(() => {});
  }, []);

  // Resolve the bridge promise if the paywall is dismissed via swipe gesture
  useEffect(() => {
    return () => { completePaywall(false); };
  }, []);

  const handleClose = () => {
    completePaywall(false);
    router.back();
  };

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      const { success, cancelled } = await purchasePro();
      if (success) {
        completePaywall(true);
        router.back();
      } else if (!cancelled) {
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Purchase Error', e?.message ?? 'Unable to complete purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        completePaywall(true);
        router.back();
      } else {
        Alert.alert('Nothing to Restore', 'No previous purchase found for this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore Error', e?.message ?? 'Unable to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={12}>
        <Ionicons name="close" size={24} color={Colors.gray} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PRO</Text>
        </View>

        <Text style={styles.headline}>Unlock Unlimited{'\n'}Agile Coaching</Text>
        <Text style={styles.subhead}>
          Get expert guidance on Scrum, SAFe, Kanban, and Agile best practices — whenever you need it.
        </Text>

        <View style={styles.featuresCard}>
          {FEATURES.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={18} color={Colors.teal} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.price}>{priceString}</Text>
          <Text style={styles.priceNote}>1-month auto-renewing subscription. Cancel anytime.</Text>
        </View>

        <TouchableOpacity
          style={[styles.subscribeButton, purchasing && styles.buttonDisabled]}
          onPress={handleSubscribe}
          disabled={purchasing || restoring}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeText}>Start Subscription</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing || restoring}
          activeOpacity={0.7}
        >
          {restoring ? (
            <ActivityIndicator color={Colors.teal} size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          Payment will be charged to your Apple ID at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}>
            App Store Settings
          </Text>
          .{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            Privacy Policy
          </Text>
          {' · '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
            Terms of Use
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.tealDim,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  badgeText: {
    color: Colors.teal,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
  },
  subhead: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.tealDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  priceCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.teal,
    marginBottom: 4,
  },
  priceNote: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  subscribeButton: {
    width: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  subscribeText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.teal,
    fontWeight: '600',
  },
  legal: {
    fontSize: 11,
    color: Colors.grayDark,
    textAlign: 'center',
    lineHeight: 16,
  },
  legalLink: {
    color: Colors.gray,
    textDecorationLine: 'underline',
  },
});
