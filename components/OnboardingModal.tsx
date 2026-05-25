import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { setUserProfile } from '../services/storage';

const ROLES = ['Scrum Master', 'Agile Coach', 'Product Owner', 'Developer', 'Manager', 'Other'];
const FRAMEWORKS = ['Scrum', 'SAFe', 'Kanban', 'LeSS', 'Spotify', 'Other'];

const PAGES = [
  {
    icon: '🎯',
    title: 'Welcome to AgileIQ',
    body: 'Your personal AI Agile coach — instant answers about Scrum, SAFe, sprint planning, retrospectives, and team dynamics.',
  },
  {
    icon: '🛠️',
    title: 'Everything you need',
    body: 'Chat with your AI coach, use Guided Sessions for sprints and retros, analyze your Jira board screenshots, and explore curated topics.',
  },
  {
    icon: '🧑‍💼',
    title: 'Personalize your coaching',
    body: 'Tell AgileIQ about yourself so every response is tailored to your role.',
    isProfile: true,
  },
];

export function OnboardingModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const [page, setPage] = useState(0);
  const [role, setRole] = useState('');
  const [framework, setFramework] = useState('');

  const handleDismiss = async () => {
    if (role || framework) {
      await setUserProfile({ role, maturity: '', framework }).catch(() => {});
    }
    setPage(0);
    setRole('');
    setFramework('');
    onDismiss();
  };

  const handleNext = () => {
    if (page < PAGES.length - 1) {
      setPage(p => p + 1);
    } else {
      handleDismiss();
    }
  };

  const isLast = page === PAGES.length - 1;
  const currentPage = PAGES[page];

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={ob.container}>
        <View style={ob.content}>
          <Text style={ob.icon}>{currentPage.icon}</Text>
          <Text style={ob.title}>{currentPage.title}</Text>
          {currentPage.isProfile ? (
            <View style={ob.profileWrap}>
              <Text style={ob.profileSectionLabel}>YOUR ROLE</Text>
              <View style={ob.chips}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[ob.chip, role === r && ob.chipActive]}
                    onPress={() => setRole(prev => prev === r ? '' : r)}
                    activeOpacity={0.75}
                  >
                    <Text style={[ob.chipText, role === r && ob.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[ob.profileSectionLabel, { marginTop: 20 }]}>PRIMARY FRAMEWORK</Text>
              <View style={ob.chips}>
                {FRAMEWORKS.map(fw => (
                  <TouchableOpacity
                    key={fw}
                    style={[ob.chip, framework === fw && ob.chipActive]}
                    onPress={() => setFramework(prev => prev === fw ? '' : fw)}
                    activeOpacity={0.75}
                  >
                    <Text style={[ob.chipText, framework === fw && ob.chipTextActive]}>{fw}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={ob.profileHint}>You can update this anytime in Settings.</Text>
            </View>
          ) : (
            <Text style={ob.body}>{currentPage.body}</Text>
          )}
        </View>

        <View style={ob.footer}>
          <View style={ob.dots}>
            {PAGES.map((_, i) => (
              <View key={i} style={[ob.dot, i === page && ob.dotActive]} />
            ))}
          </View>
          <TouchableOpacity style={ob.btn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={ob.btnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          </TouchableOpacity>
          {!isLast && (
            <TouchableOpacity onPress={handleDismiss} style={ob.skipBtn} activeOpacity={0.7}>
              <Text style={ob.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const ob = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  icon: { fontSize: 72, marginBottom: 28 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  body: {
    fontSize: 17,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  profileWrap: {
    alignSelf: 'stretch',
  },
  profileSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.tealDim,
    borderColor: Colors.teal,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.tealLight,
    fontWeight: '600',
  },
  profileHint: {
    fontSize: 12,
    color: Colors.grayDark,
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 16,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.teal, width: 22 },
  btn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 17 },
  skipBtn: { paddingVertical: 4 },
  skipText: { fontSize: 15, color: Colors.grayDark },
});
