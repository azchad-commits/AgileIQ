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

const PAGES = [
  {
    icon: '🎯',
    title: 'Welcome to AgileIQ',
    body: 'Your personal AI Agile coach — instant answers about Scrum, SAFe, sprint planning, retrospectives, and team dynamics.',
  },
  {
    icon: '💬',
    title: 'Ask anything',
    body: 'Type a question, browse Topics for guided prompts, or upload a screenshot of your Jira board for a full AI analysis.',
  },
  {
    icon: '🔑',
    title: 'Add your API key',
    body: 'AgileIQ uses the Anthropic Claude API. Get a free key at console.anthropic.com, then add it in Settings for unlimited use.',
  },
];

export function OnboardingModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const [page, setPage] = useState(0);

  const handleDismiss = () => {
    setPage(0);
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

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={ob.container}>
        <View style={ob.content}>
          <Text style={ob.icon}>{PAGES[page].icon}</Text>
          <Text style={ob.title}>{PAGES[page].title}</Text>
          <Text style={ob.body}>{PAGES[page].body}</Text>
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
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  icon: { fontSize: 72, marginBottom: 32 },
  title: {
    fontSize: 28,
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
