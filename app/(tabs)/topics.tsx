import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';

interface Topic {
  title: string;
  emoji: string;
  color: string;
  prompts: string[];
}

const TOPICS: Topic[] = [
  {
    title: 'Scrum',
    emoji: '🔄',
    color: '#1D9E75',
    prompts: [
      'What are the three pillars of Scrum?',
      'How do I write a good Definition of Done?',
      'What makes a Sprint Goal effective?',
      'How should the Scrum Team handle unplanned work mid-Sprint?',
      'What is the difference between a Sprint Review and a Sprint Retrospective?',
    ],
  },
  {
    title: 'SAFe',
    emoji: '🏛️',
    color: '#6366F1',
    prompts: [
      'What is a Program Increment (PI) and how do we plan one?',
      'How does SAFe define the role of a Release Train Engineer?',
      'What is an Agile Release Train (ART)?',
      'How do we manage dependencies across teams in SAFe?',
      'What is the difference between SAFe Essential and SAFe Full?',
    ],
  },
  {
    title: 'Coaching',
    emoji: '🎯',
    color: '#F59E0B',
    prompts: [
      'What are the 8 stances of a Scrum Master?',
      'How do I coach a team that is resistant to Agile?',
      'What questions should I ask in a 1:1 with a team member?',
      'How do I help a team self-organize more effectively?',
      'What is the difference between coaching and mentoring?',
    ],
  },
  {
    title: 'Ceremonies',
    emoji: '📅',
    color: '#EC4899',
    prompts: [
      'How do I facilitate a better Sprint Retrospective?',
      'What is the ideal structure for Sprint Planning?',
      'How do we keep Daily Standups from becoming status updates?',
      'How should we run Backlog Refinement effectively?',
      'What makes a Sprint Review valuable for stakeholders?',
    ],
  },
  {
    title: 'Metrics',
    emoji: '📊',
    color: '#14B8A6',
    prompts: [
      'What Agile metrics should we track and why?',
      'How do we use velocity without making it a commitment?',
      'What is cycle time and how do we improve it?',
      'How do we measure team health?',
      'What are OKRs and how do they relate to Agile?',
    ],
  },
  {
    title: 'Lean',
    emoji: '⚡',
    color: '#F97316',
    prompts: [
      'What are the 7 types of waste in Lean software development?',
      'How does Kanban differ from Scrum?',
      'What is a value stream map and how do I create one?',
      'How does WIP limiting improve flow?',
      'What is the Toyota Kata and how can I use it with my team?',
    ],
  },
];

export default function TopicsScreen() {
  const handlePrompt = (prompt: string) => {
    router.navigate({ pathname: '/', params: { prompt } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Topics</Text>
        <Text style={styles.headerSub}>Tap a question to ask AgileIQ</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {TOPICS.map(topic => (
          <TopicCard key={topic.title} topic={topic} onPrompt={handlePrompt} />
        ))}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TopicCard({ topic, onPrompt }: { topic: Topic; onPrompt: (p: string) => void }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBadge, { backgroundColor: topic.color + '22' }]}>
          <Text style={styles.emoji}>{topic.emoji}</Text>
        </View>
        <Text style={styles.cardTitle}>{topic.title}</Text>
        <Text style={[styles.chevron, { color: topic.color }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.promptList}>
          {topic.prompts.map(p => (
            <TouchableOpacity
              key={p}
              style={styles.promptRow}
              onPress={() => onPrompt(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.promptDot, { color: topic.color }]}>•</Text>
              <Text style={styles.promptText}>{p}</Text>
              <Text style={[styles.promptArrow, { color: topic.color }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  chevron: {
    fontSize: 12,
    fontWeight: '700',
  },
  promptList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 4,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  promptDot: {
    fontSize: 16,
    width: 14,
  },
  promptText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  promptArrow: {
    fontSize: 22,
    fontWeight: '300',
  },
  bottomPad: {
    height: 16,
  },
});
