import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';

// ── Module-level constants ────────────────────────────────────────────────────

const STANDUP_BLOCKERS = [
  'Dependencies', 'Unclear requirements', 'Technical debt',
  'WIP overload', 'Team absence', 'Environment issues',
];
const REFINEMENT_ISSUES = [
  'Too large', 'Missing ACs', 'Unclear value',
  'Hidden dependencies', 'Tech uncertainty', 'Stale story',
];
const HEALTH_DIMENSIONS = [
  'Delivering value', 'Easy to release', 'Fun', 'Learning',
  'Mission', 'Speed', 'Support', 'Teamwork',
];
const PI_OBJ_COUNTS = ['1', '2', '3', '4', '5', '6+'];
const PI_RISKS = ['Dependencies', 'Capacity', 'Technology', 'Business alignment', 'Architecture'];

const SPRINT_CONCERNS = [
  'Too many carry-overs',
  'Scope creep',
  'Team availability',
  'Unclear requirements',
  'Technical debt',
  'Dependencies',
];

// ── Product Management constants ──────────────────────────────────────────────
const OKR_TIMEFRAMES = ['This Quarter', 'Next Quarter', 'Half-Year', 'Annual'];
const OKR_LEVELS = ['Individual', 'Team', 'Department', 'Company'];
const PRIORITY_FRAMEWORKS = ['RICE', 'MoSCoW', 'Kano', 'Weighted Scoring'];
const STAKEHOLDER_AUDIENCES = ['Executive / VP', 'Board', 'Engineering', 'Sales & Marketing', 'All-Hands'];
const ROADMAP_HORIZONS = ['3 months', '6 months', '12 months', '18 months'];
const ROADMAP_THEMES = ['Feature-based', 'Outcome-based', 'Problem-based', 'Technology'];
const RESEARCH_SOURCES = ['User interviews', 'NPS / survey data', 'Support tickets', 'Usage analytics', 'Sales calls'];

const RETRO_FORMATS = ['Start/Stop/Continue', '4Ls', 'Mad/Sad/Glad', 'Rose/Thorn/Bud', 'ORID'];
const RETRO_TIMES = ['30 min', '45 min', '60 min', '90 min'];
const STORY_COUNTS = ['3', '5', '8', '10'];

// ── Ceremony Timer constants ──────────────────────────────────────────────────
const CEREMONY_PRESETS = [
  { name: 'Daily Standup', minutes: 15, emoji: '☀️' },
  { name: 'Sprint Planning', minutes: 120, emoji: '🏃' },
  { name: 'Sprint Review', minutes: 60, emoji: '📋' },
  { name: 'Retrospective', minutes: 60, emoji: '🔄' },
  { name: 'Refinement', minutes: 90, emoji: '✨' },
  { name: 'PI Planning', minutes: 480, emoji: '🗓️' },
];

// ── Cert Prep constants ───────────────────────────────────────────────────────
const CERTS = [
  { id: 'psm1', name: 'PSM I', full: 'Professional Scrum Master I', org: 'Scrum.org' },
  { id: 'psm2', name: 'PSM II', full: 'Professional Scrum Master II', org: 'Scrum.org' },
  { id: 'pspo1', name: 'PSPO I', full: 'Professional Scrum Product Owner I', org: 'Scrum.org' },
  { id: 'safe-sa', name: 'SAFe SA', full: 'SAFe Agilist', org: 'Scaled Agile' },
  { id: 'csm', name: 'CSM', full: 'Certified ScrumMaster', org: 'Scrum Alliance' },
  { id: 'cspo', name: 'CSPO', full: 'Certified Scrum Product Owner', org: 'Scrum Alliance' },
];
const STUDY_MODES = [
  { id: 'practice', label: 'Practice Questions', desc: '5 realistic exam-style questions with explanations' },
  { id: 'concept', label: 'Concept Review', desc: 'Key topics and knowledge areas I must master' },
  { id: 'weak', label: 'Weak Spots', desc: 'Quiz me on the most commonly failed areas' },
  { id: 'mock', label: 'Mock Exam', desc: '10-question mock with scoring and detailed feedback' },
];

// ── Shared bottom sheet ───────────────────────────────────────────────────────

function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { height: screenHeight } = useWindowDimensions();
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={sh.overlay}>
        <TouchableOpacity style={sh.backdrop} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[sh.container, { height: screenHeight * 0.88 }]}
        >
          <View style={sh.handle} />
          <View style={sh.header}>
            <Text style={sh.title}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={sh.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={sh.body}
            contentContainerStyle={sh.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
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
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  close: { fontSize: 18, color: Colors.grayDark, fontWeight: '500' },
  body: { flex: 1 },
  bodyContent: { padding: 20 },
});

// ── Chip group ────────────────────────────────────────────────────────────────

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
  multi = false,
}: {
  label: string;
  options: string[];
  selected: string | string[];
  onSelect: (v: string) => void;
  multi?: boolean;
}) {
  const isActive = (v: string) =>
    multi ? (selected as string[]).includes(v) : selected === v;

  return (
    <View style={cg.wrapper}>
      <Text style={cg.label}>{label}</Text>
      <View style={cg.row}>
        {options.map(o => (
          <TouchableOpacity
            key={o}
            style={[cg.chip, isActive(o) && cg.chipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(o);
            }}
            activeOpacity={0.75}
          >
            <Text style={[cg.chipText, isActive(o) && cg.chipTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const cg = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.grayDark, letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.navyMid,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.tealDim, borderColor: Colors.teal },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: Colors.tealLight, fontWeight: '600' },
});

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={sp.row}>
      <Text style={sp.label}>{label}</Text>
      <View style={sp.controls}>
        <TouchableOpacity
          style={[sp.btn, value <= min && sp.btnDisabled]}
          onPress={() => value > min && onChange(value - 1)}
          activeOpacity={0.7}
        >
          <Text style={sp.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={sp.val}>{value}</Text>
        <TouchableOpacity
          style={[sp.btn, value >= max && sp.btnDisabled]}
          onPress={() => value < max && onChange(value + 1)}
          activeOpacity={0.7}
        >
          <Text style={sp.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 4,
  },
  label: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.navyMid,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontSize: 18, color: Colors.text, fontWeight: '600', lineHeight: 20 },
  val: { fontSize: 17, fontWeight: '700', color: Colors.text, minWidth: 28, textAlign: 'center' },
});

// ── Form field shared styles ──────────────────────────────────────────────────

const f = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.navyMid,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 20,
  },
  textArea: {
    backgroundColor: Colors.navyMid,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: Colors.navyMid },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});

// ── Sprint Planner ────────────────────────────────────────────────────────────

function SprintPlannerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [goal, setGoal] = useState('');
  const [teamSize, setTeamSize] = useState(6);
  const [velocity, setVelocity] = useState('');
  const [concerns, setConcerns] = useState<string[]>([]);

  const toggleConcern = (v: string) =>
    setConcerns(prev => prev.includes(v) ? prev.filter(c => c !== v) : [...prev, v]);

  const handleGenerate = () => {
    if (!goal.trim()) return;
    const parts = [
      `Help me plan our next sprint.\n\n**Sprint Goal:** ${goal.trim()}`,
      `\n**Team size:** ${teamSize} people`,
      velocity.trim() ? `\n**Velocity:** ${velocity.trim()} story points` : '',
      concerns.length > 0 ? `\n**Top concerns:** ${concerns.join(', ')}` : '',
      `\n\nPlease provide:\n1. Recommended sprint structure and capacity breakdown\n2. How to sequence work to achieve the sprint goal\n3. Specific coaching advice on our concerns\n4. 3–4 sharp questions to ask in sprint planning`,
    ];
    const prompt = parts.join('');
    const chatTitle = `Sprint Plan: ${goal.trim().slice(0, 50)}`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => {
    setGoal('');
    setTeamSize(6);
    setVelocity('');
    setConcerns([]);
  };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🏃 Sprint Planner">
      <Text style={f.fieldLabel}>SPRINT GOAL *</Text>
      <TextInput
        style={f.textArea}
        value={goal}
        onChangeText={setGoal}
        placeholder="What should this sprint achieve?"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={200}
      />
      <Stepper label="Team size" value={teamSize} min={2} max={20} onChange={setTeamSize} />
      <Text style={f.fieldLabel}>VELOCITY (story points)</Text>
      <TextInput
        style={f.input}
        value={velocity}
        onChangeText={setVelocity}
        placeholder="e.g. 40"
        placeholderTextColor={Colors.grayDark}
        keyboardType="number-pad"
        maxLength={5}
      />
      <ChipGroup
        label="TOP CONCERNS (pick any)"
        options={SPRINT_CONCERNS}
        selected={concerns}
        onSelect={toggleConcern}
        multi
      />
      <TouchableOpacity
        style={[f.submitBtn, !goal.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!goal.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Generate Sprint Plan →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Retro Facilitator ─────────────────────────────────────────────────────────

function RetroSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [format, setFormat] = useState('');
  const [teamSize, setTeamSize] = useState(6);
  const [timeBox, setTimeBox] = useState('60 min');

  const handleGenerate = () => {
    if (!format) return;
    const prompt = `Facilitate a **${format}** retrospective for our team of ${teamSize} people with ${timeBox} available.\n\nPlease:\n1. Briefly explain the ${format} format (2–3 sentences)\n2. Give 4–5 strong questions for each category that spark honest reflection\n3. Suggest a time allocation breakdown for ${timeBox}\n4. Give 2–3 tips for drawing out quieter team members\n5. Explain how to close the retro: turning insights into 1–2 committed action items`;
    const chatTitle = `${format} Retrospective`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => {
    setFormat('');
    setTeamSize(6);
    setTimeBox('60 min');
  };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🔄 Retro Facilitator">
      <ChipGroup
        label="RETROSPECTIVE FORMAT *"
        options={RETRO_FORMATS}
        selected={format}
        onSelect={setFormat}
      />
      <Stepper label="Team size" value={teamSize} min={2} max={30} onChange={setTeamSize} />
      <ChipGroup label="TIME AVAILABLE" options={RETRO_TIMES} selected={timeBox} onSelect={setTimeBox} />
      <TouchableOpacity
        style={[f.submitBtn, !format && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!format}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Facilitate Retrospective →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── User Story Workshop ───────────────────────────────────────────────────────

function UserStorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [epic, setEpic] = useState('');
  const [persona, setPersona] = useState('');
  const [count, setCount] = useState('5');

  const handleGenerate = () => {
    if (!epic.trim()) return;
    const parts = [
      `Write user stories for this feature/epic:\n\n**${epic.trim()}**`,
      persona.trim() ? `\n\n**Primary persona:** ${persona.trim()}` : '',
      `\n\nPlease generate:\n1. ${count} well-formed user stories in "As a [persona], I want [goal], so that [benefit]" format\n2. 3–5 acceptance criteria for the most important story\n3. Flag any story that's too large and suggest how to split it\n4. Identify edge cases and dependencies worth capturing in the backlog`,
    ];
    const prompt = parts.join('');
    const chatTitle = `User Stories: ${epic.trim().slice(0, 40)}`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => {
    setEpic('');
    setPersona('');
    setCount('5');
  };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="📝 User Story Workshop">
      <Text style={f.fieldLabel}>FEATURE OR EPIC *</Text>
      <TextInput
        style={[f.textArea, { minHeight: 90 }]}
        value={epic}
        onChangeText={setEpic}
        placeholder="Describe what you're building and why…"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={400}
      />
      <Text style={f.fieldLabel}>PRIMARY PERSONA (optional)</Text>
      <TextInput
        style={f.input}
        value={persona}
        onChangeText={setPersona}
        placeholder="e.g. Scrum Master, end user, product manager"
        placeholderTextColor={Colors.grayDark}
        maxLength={80}
      />
      <ChipGroup label="NUMBER OF STORIES" options={STORY_COUNTS} selected={count} onSelect={setCount} />
      <TouchableOpacity
        style={[f.submitBtn, !epic.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!epic.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Generate User Stories →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Daily Standup ─────────────────────────────────────────────────────────────

function DailyStandupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [teamSize, setTeamSize] = useState(6);
  const [blockers, setBlockers] = useState<string[]>([]);

  const toggleBlocker = (v: string) =>
    setBlockers(prev => prev.includes(v) ? prev.filter(b => b !== v) : [...prev, v]);

  const handleGenerate = () => {
    if (!yesterday.trim() && !today.trim()) return;
    const parts = [
      `Help me prepare for today's Daily Scrum.`,
      yesterday.trim() ? `\n\n**Completed yesterday:** ${yesterday.trim()}` : '',
      today.trim() ? `\n\n**Planned for today:** ${today.trim()}` : '',
      blockers.length > 0 ? `\n\n**Blockers/impediments:** ${blockers.join(', ')}` : '',
      `\n**Team size:** ${teamSize}`,
      `\n\nPlease:\n1. Help me frame a clear, focused standup update\n2. Identify any hidden risks or dependencies in what I've shared\n3. Suggest how to raise any impediments effectively\n4. Give 1–2 coaching tips for running a tight, valuable Daily Scrum`,
    ];
    const chatTitle = 'Daily Standup Prep';
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setYesterday(''); setToday(''); setTeamSize(6); setBlockers([]); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="☀️ Daily Standup">
      <Text style={f.fieldLabel}>COMPLETED YESTERDAY</Text>
      <TextInput style={f.textArea} value={yesterday} onChangeText={setYesterday}
        placeholder="What did you finish or work on?" placeholderTextColor={Colors.grayDark}
        multiline maxLength={300} />
      <Text style={f.fieldLabel}>PLANNED FOR TODAY *</Text>
      <TextInput style={f.textArea} value={today} onChangeText={setToday}
        placeholder="What are you working on today?" placeholderTextColor={Colors.grayDark}
        multiline maxLength={300} />
      <Stepper label="Team size" value={teamSize} min={2} max={20} onChange={setTeamSize} />
      <ChipGroup label="BLOCKERS (pick any)" options={STANDUP_BLOCKERS} selected={blockers} onSelect={toggleBlocker} multi />
      <TouchableOpacity
        style={[f.submitBtn, (!yesterday.trim() && !today.trim()) && f.submitBtnDisabled]}
        onPress={handleGenerate} disabled={!yesterday.trim() && !today.trim()} activeOpacity={0.85}>
        <Text style={f.submitBtnText}>Prepare Standup →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Backlog Refinement ────────────────────────────────────────────────────────

function BacklogRefinementSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [stories, setStories] = useState('');
  const [teamSize, setTeamSize] = useState(6);
  const [issues, setIssues] = useState<string[]>([]);

  const toggleIssue = (v: string) =>
    setIssues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const handleGenerate = () => {
    if (!stories.trim()) return;
    const parts = [
      `Help me refine these backlog items:\n\n${stories.trim()}`,
      issues.length > 0 ? `\n\n**Common issues I'm seeing:** ${issues.join(', ')}` : '',
      `\n**Team size:** ${teamSize}`,
      `\n\nFor each story please:\n1. Assess readiness (Definition of Ready check)\n2. Identify gaps in acceptance criteria\n3. Flag stories that need splitting and suggest how\n4. Estimate relative complexity (S/M/L/XL)\n5. Surface hidden dependencies or risks`,
    ];
    const chatTitle = 'Backlog Refinement';
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setStories(''); setTeamSize(6); setIssues([]); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="📋 Backlog Refinement">
      <Text style={f.fieldLabel}>STORIES TO REFINE *</Text>
      <TextInput style={[f.textArea, { minHeight: 100 }]} value={stories} onChangeText={setStories}
        placeholder="Paste or describe the stories you want to refine…" placeholderTextColor={Colors.grayDark}
        multiline maxLength={600} />
      <Stepper label="Team size" value={teamSize} min={2} max={20} onChange={setTeamSize} />
      <ChipGroup label="COMMON ISSUES (pick any)" options={REFINEMENT_ISSUES} selected={issues} onSelect={toggleIssue} multi />
      <TouchableOpacity
        style={[f.submitBtn, !stories.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate} disabled={!stories.trim()} activeOpacity={0.85}>
        <Text style={f.submitBtnText}>Refine Stories →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Team Health Check ─────────────────────────────────────────────────────────

function TeamHealthSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState(6);
  const [context, setContext] = useState('');

  const toggleDimension = (v: string) =>
    setDimensions(prev => prev.includes(v) ? prev.filter(d => d !== v) : [...prev, v]);

  const handleGenerate = () => {
    const selected = dimensions.length > 0 ? dimensions : HEALTH_DIMENSIONS;
    const parts = [
      `Run a Team Health Check for our Agile team of ${teamSize} people.`,
      context.trim() ? `\n\n**Context:** ${context.trim()}` : '',
      `\n\n**Focus areas:** ${selected.join(', ')}`,
      `\n\nPlease:\n1. For each area, provide 3 diagnostic questions the team should honestly answer\n2. Describe what healthy vs. unhealthy looks like for each\n3. Suggest one concrete improvement action per area\n4. Recommend how to run the health check session (format, timing, facilitation tips)`,
    ];
    const chatTitle = 'Team Health Check';
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setDimensions([]); setTeamSize(6); setContext(''); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="❤️ Team Health Check">
      <Stepper label="Team size" value={teamSize} min={2} max={30} onChange={setTeamSize} />
      <Text style={f.fieldLabel}>TEAM CONTEXT (optional)</Text>
      <TextInput style={f.textArea} value={context} onChangeText={setContext}
        placeholder="e.g. Remote team, new members joining, post-release…"
        placeholderTextColor={Colors.grayDark} multiline maxLength={200} />
      <ChipGroup label="FOCUS AREAS (pick any, or leave blank for all)" options={HEALTH_DIMENSIONS}
        selected={dimensions} onSelect={toggleDimension} multi />
      <TouchableOpacity style={f.submitBtn} onPress={handleGenerate} activeOpacity={0.85}>
        <Text style={f.submitBtnText}>Run Health Check →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── PI Planning ───────────────────────────────────────────────────────────────

function PIPlanningSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [piGoal, setPiGoal] = useState('');
  const [teams, setTeams] = useState(4);
  const [objectives, setObjectives] = useState('3');
  const [risks, setRisks] = useState<string[]>([]);

  const toggleRisk = (v: string) =>
    setRisks(prev => prev.includes(v) ? prev.filter(r => r !== v) : [...prev, v]);

  const handleGenerate = () => {
    if (!piGoal.trim()) return;
    const parts = [
      `Help me plan our SAFe PI Planning event.`,
      `\n\n**PI Goal / Vision:** ${piGoal.trim()}`,
      `\n**Number of teams:** ${teams}`,
      `\n**PI Objectives target per team:** ${objectives}`,
      risks.length > 0 ? `\n**Known risks:** ${risks.join(', ')}` : '',
      `\n\nPlease provide:\n1. Recommended PI Planning agenda and timing for ${teams} teams\n2. How to craft strong, measurable PI Objectives\n3. ROAM framework guidance for the identified risks\n4. Tips for the team breakout sessions\n5. How to run a successful System Demo and Inspect & Adapt`,
    ];
    const chatTitle = `PI Planning: ${piGoal.trim().slice(0, 40)}`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setPiGoal(''); setTeams(4); setObjectives('3'); setRisks([]); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🗓️ PI Planning">
      <Text style={f.fieldLabel}>PI GOAL / VISION *</Text>
      <TextInput style={f.textArea} value={piGoal} onChangeText={setPiGoal}
        placeholder="What is the overarching goal for this Program Increment?"
        placeholderTextColor={Colors.grayDark} multiline maxLength={300} />
      <Stepper label="Number of teams" value={teams} min={2} max={15} onChange={setTeams} />
      <ChipGroup label="PI OBJECTIVES PER TEAM" options={PI_OBJ_COUNTS} selected={objectives} onSelect={setObjectives} />
      <ChipGroup label="KNOWN RISKS (pick any)" options={PI_RISKS} selected={risks} onSelect={toggleRisk} multi />
      <TouchableOpacity
        style={[f.submitBtn, !piGoal.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate} disabled={!piGoal.trim()} activeOpacity={0.85}>
        <Text style={f.submitBtnText}>Plan the PI →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── OKR Builder ───────────────────────────────────────────────────────────────

function OKRBuilderSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [objective, setObjective] = useState('');
  const [keyResults, setKeyResults] = useState('');
  const [timeframe, setTimeframe] = useState('This Quarter');
  const [level, setLevel] = useState('Team');

  const handleGenerate = () => {
    if (!objective.trim()) return;
    const parts = [
      `Help me build strong OKRs for our team.\n\n**Objective:** ${objective.trim()}`,
      keyResults.trim() ? `\n\n**Draft Key Results (to improve):** ${keyResults.trim()}` : '',
      `\n**Timeframe:** ${timeframe}`,
      `\n**Level:** ${level}`,
      `\n\nPlease provide:\n1. Refine or rewrite the Objective so it is inspiring and qualitative\n2. Write 3–4 strong Key Results that are measurable, outcome-focused, and time-bound\n3. For each Key Result: suggest a leading indicator and how to track it\n4. Flag any Key Results that sound like tasks rather than outcomes and fix them\n5. Give 2–3 tips for keeping the team aligned to these OKRs throughout the ${timeframe.toLowerCase()}`,
    ];
    const chatTitle = `OKRs: ${objective.trim().slice(0, 40)}`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setObjective(''); setKeyResults(''); setTimeframe('This Quarter'); setLevel('Team'); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🎯 OKR Builder">
      <Text style={f.fieldLabel}>OBJECTIVE *</Text>
      <TextInput
        style={[f.textArea, { minHeight: 80 }]}
        value={objective}
        onChangeText={setObjective}
        placeholder="What do you want to achieve this quarter?"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={300}
      />
      <Text style={f.fieldLabel}>DRAFT KEY RESULTS (optional)</Text>
      <TextInput
        style={[f.textArea, { minHeight: 80 }]}
        value={keyResults}
        onChangeText={setKeyResults}
        placeholder="Paste any draft KRs — AgileCoachIQ will refine them…"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={400}
      />
      <ChipGroup label="TIMEFRAME" options={OKR_TIMEFRAMES} selected={timeframe} onSelect={setTimeframe} />
      <ChipGroup label="LEVEL" options={OKR_LEVELS} selected={level} onSelect={setLevel} />
      <TouchableOpacity
        style={[f.submitBtn, !objective.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!objective.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Build OKRs →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Feature Prioritization ────────────────────────────────────────────────────

function FeaturePrioritizationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [features, setFeatures] = useState('');
  const [framework, setFramework] = useState('RICE');
  const [context, setContext] = useState('');

  const handleGenerate = () => {
    if (!features.trim()) return;
    const parts = [
      `Help me prioritize these features using the **${framework}** framework.\n\n**Features to prioritize:**\n${features.trim()}`,
      context.trim() ? `\n\n**Context / constraints:** ${context.trim()}` : '',
      framework === 'RICE'
        ? `\n\nFor each feature:\n1. Estimate Reach, Impact, Confidence, and Effort on a consistent scale\n2. Calculate the RICE score\n3. Rank the features by score\n4. Flag assumptions and risks in your estimates\n5. Recommend what to tackle first and why`
        : framework === 'MoSCoW'
        ? `\n\nFor each feature:\n1. Assign Must Have / Should Have / Could Have / Won't Have\n2. Explain the rationale for each classification\n3. Identify any Must Haves at risk of scope creep\n4. Suggest which Could Haves to cut first if pressed for time`
        : framework === 'Kano'
        ? `\n\nFor each feature:\n1. Classify as Basic Need / Performance / Excitement / Indifferent / Reverse\n2. Explain the Kano reasoning for each\n3. Highlight which Excitement features could be differentiators\n4. Recommend a prioritization order based on customer delight`
        : `\n\nFor each feature:\n1. Score on Value (1–10), Effort (1–10), Risk (1–10), Strategic Fit (1–10)\n2. Provide a weighted composite score\n3. Rank the features\n4. Explain any trade-offs in the top items`,
    ];
    const chatTitle = `${framework} Prioritization`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setFeatures(''); setFramework('RICE'); setContext(''); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="⚖️ Feature Prioritization">
      <Text style={f.fieldLabel}>FEATURES TO PRIORITIZE *</Text>
      <TextInput
        style={[f.textArea, { minHeight: 100 }]}
        value={features}
        onChangeText={setFeatures}
        placeholder="List your features or user stories, one per line…"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={600}
      />
      <ChipGroup label="FRAMEWORK" options={PRIORITY_FRAMEWORKS} selected={framework} onSelect={setFramework} />
      <Text style={f.fieldLabel}>CONTEXT / CONSTRAINTS (optional)</Text>
      <TextInput
        style={f.input}
        value={context}
        onChangeText={setContext}
        placeholder="e.g. Q3 launch, mobile-first, limited team bandwidth"
        placeholderTextColor={Colors.grayDark}
        maxLength={200}
      />
      <TouchableOpacity
        style={[f.submitBtn, !features.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!features.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Prioritize Features →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Stakeholder Update ────────────────────────────────────────────────────────

function StakeholderUpdateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [progress, setProgress] = useState('');
  const [audience, setAudience] = useState('Executive / VP');
  const [highlights, setHighlights] = useState('');
  const [risks, setRisks] = useState('');

  const handleGenerate = () => {
    if (!progress.trim()) return;
    const parts = [
      `Write a stakeholder product update for **${audience}** stakeholders.\n\n**Progress this period:** ${progress.trim()}`,
      highlights.trim() ? `\n\n**Key wins / highlights:** ${highlights.trim()}` : '',
      risks.trim() ? `\n\n**Risks or blockers to surface:** ${risks.trim()}` : '',
      `\n\nPlease:\n1. Write a concise, clear narrative update tailored to the ${audience} audience\n2. Lead with outcomes and value, not just activity\n3. Summarize the top 3 wins in bullet form\n4. Address risks with a recommended action or owner for each\n5. Close with the key focus for the next period\n6. Keep the tone appropriate: confident, transparent, and forward-looking`,
    ];
    const chatTitle = `${audience} Update`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setProgress(''); setAudience('Executive / VP'); setHighlights(''); setRisks(''); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="📣 Stakeholder Update">
      <ChipGroup label="AUDIENCE" options={STAKEHOLDER_AUDIENCES} selected={audience} onSelect={setAudience} />
      <Text style={f.fieldLabel}>PROGRESS THIS PERIOD *</Text>
      <TextInput
        style={[f.textArea, { minHeight: 90 }]}
        value={progress}
        onChangeText={setProgress}
        placeholder="What did the team ship, build, or learn?"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={400}
      />
      <Text style={f.fieldLabel}>KEY WINS (optional)</Text>
      <TextInput
        style={f.input}
        value={highlights}
        onChangeText={setHighlights}
        placeholder="e.g. Launched onboarding v2, reduced churn by 8%"
        placeholderTextColor={Colors.grayDark}
        maxLength={200}
      />
      <Text style={f.fieldLabel}>RISKS OR BLOCKERS (optional)</Text>
      <TextInput
        style={f.input}
        value={risks}
        onChangeText={setRisks}
        placeholder="e.g. Vendor delay, unclear requirements from legal"
        placeholderTextColor={Colors.grayDark}
        maxLength={200}
      />
      <TouchableOpacity
        style={[f.submitBtn, !progress.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!progress.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Generate Update →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Product Roadmap Builder ───────────────────────────────────────────────────

function ProductRoadmapSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [vision, setVision] = useState('');
  const [themes, setThemes] = useState('');
  const [horizon, setHorizon] = useState('6 months');
  const [roadmapType, setRoadmapType] = useState('Outcome-based');

  const handleGenerate = () => {
    if (!vision.trim()) return;
    const parts = [
      `Help me build a **${roadmapType} product roadmap** covering the next **${horizon}**.`,
      `\n\n**Product vision / goal:** ${vision.trim()}`,
      themes.trim() ? `\n\n**Themes or initiatives I'm considering:** ${themes.trim()}` : '',
      `\n\nPlease:\n1. Structure a ${horizon} roadmap with clear Now / Next / Later (or monthly) horizons\n2. Organize it around ${roadmapType.replace('-based', '')} themes, not just features\n3. For each theme: describe the customer outcome, key bets, and success signal\n4. Highlight dependencies and sequencing logic\n5. Suggest 2–3 questions to validate each theme before committing\n6. Give advice on how to present this roadmap to stakeholders without over-committing`,
    ];
    const chatTitle = `${roadmapType} Roadmap (${horizon})`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setVision(''); setThemes(''); setHorizon('6 months'); setRoadmapType('Outcome-based'); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🗺️ Roadmap Builder">
      <Text style={f.fieldLabel}>PRODUCT VISION / GOAL *</Text>
      <TextInput
        style={[f.textArea, { minHeight: 80 }]}
        value={vision}
        onChangeText={setVision}
        placeholder="What problem are you solving and for whom?"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={300}
      />
      <Text style={f.fieldLabel}>THEMES OR INITIATIVES (optional)</Text>
      <TextInput
        style={f.textArea}
        value={themes}
        onChangeText={setThemes}
        placeholder="e.g. Mobile experience, Onboarding, Enterprise compliance…"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={300}
      />
      <ChipGroup label="ROADMAP TYPE" options={ROADMAP_THEMES} selected={roadmapType} onSelect={setRoadmapType} />
      <ChipGroup label="HORIZON" options={ROADMAP_HORIZONS} selected={horizon} onSelect={setHorizon} />
      <TouchableOpacity
        style={[f.submitBtn, !vision.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!vision.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Build Roadmap →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Research Synthesis ────────────────────────────────────────────────────────

function ResearchSynthesisSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [findings, setFindings] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [question, setQuestion] = useState('');

  const toggleSource = (v: string) =>
    setSources(prev => prev.includes(v) ? prev.filter(s => s !== v) : [...prev, v]);

  const handleGenerate = () => {
    if (!findings.trim()) return;
    const sourceLine = sources.length > 0 ? `\n\n**Sources:** ${sources.join(', ')}` : '';
    const questionLine = question.trim() ? `\n\n**Research question I'm trying to answer:** ${question.trim()}` : '';
    const parts = [
      `Help me synthesize product research findings into actionable insights.\n\n**Raw findings / data:**\n${findings.trim()}${sourceLine}${questionLine}`,
      `\n\nPlease:\n1. Identify the top 3–5 themes or patterns across the findings\n2. For each theme: summarize evidence, assess signal strength (strong / weak / mixed), and state the implication for the product\n3. Surface any tensions or contradictions in the data\n4. Recommend 2–3 specific product or process actions based on the insights\n5. Suggest follow-up research questions to sharpen understanding\n6. Note any gaps or biases in the data that might skew conclusions`,
    ];
    const chatTitle = 'Research Synthesis';
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setFindings(''); setSources([]); setQuestion(''); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🔬 Research Synthesis">
      <Text style={f.fieldLabel}>RESEARCH FINDINGS *</Text>
      <TextInput
        style={[f.textArea, { minHeight: 120 }]}
        value={findings}
        onChangeText={setFindings}
        placeholder="Paste quotes, survey results, key observations, or data points…"
        placeholderTextColor={Colors.grayDark}
        multiline
        maxLength={800}
      />
      <Text style={f.fieldLabel}>RESEARCH QUESTION (optional)</Text>
      <TextInput
        style={f.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="e.g. Why do users abandon onboarding at step 3?"
        placeholderTextColor={Colors.grayDark}
        maxLength={200}
      />
      <ChipGroup label="DATA SOURCES (pick any)" options={RESEARCH_SOURCES} selected={sources} onSelect={toggleSource} multi />
      <TouchableOpacity
        style={[f.submitBtn, !findings.trim() && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!findings.trim()}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Synthesize Findings →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

// ── Ceremony Timer ────────────────────────────────────────────────────────────

function CeremonyTimerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [preset, setPreset] = useState<string | null>(null);
  const [customMins, setCustomMins] = useState('');
  const [totalSecs, setTotalSecs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'running' | 'paused' | 'done'>('setup');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => {
    if (!visible) { clearTimer(); setPhase('setup'); setPreset(null); setCustomMins(''); setTimeLeft(0); setTotalSecs(0); }
  }, [visible]);

  // Clear interval on unmount (tab navigation doesn't flip visible to false)
  useEffect(() => () => clearTimer(), []);

  const tick = useCallback(() => {
    setTimeLeft(t => {
      if (t <= 1) {
        clearTimer();
        setPhase('done');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Time's up!", 'The timebox has ended.', [{ text: 'OK' }]);
        return 0;
      }
      return t - 1;
    });
  }, []);

  const handleStart = () => {
    const mins = preset
      ? (CEREMONY_PRESETS.find(p => p.name === preset)?.minutes ?? 0)
      : parseInt(customMins, 10);
    if (!mins || mins <= 0) return;
    const secs = mins * 60;
    setTotalSecs(secs);
    setTimeLeft(secs);
    setPhase('running');
    intervalRef.current = setInterval(tick, 1000);
  };

  const handlePause = () => { clearTimer(); setPhase('paused'); };

  const handleResume = () => {
    clearTimer();
    setPhase('running');
    intervalRef.current = setInterval(tick, 1000);
  };

  const handleReset = () => { clearTimer(); setPhase('setup'); setTimeLeft(0); setTotalSecs(0); };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const progress = totalSecs > 0 ? (totalSecs - timeLeft) / totalSecs : 0;
  const isReady = !!(preset || (customMins.trim() && parseInt(customMins, 10) > 0));
  const selectedPresetData = CEREMONY_PRESETS.find(p => p.name === preset);

  return (
    <Sheet visible={visible} onClose={() => { clearTimer(); onClose(); }} title="⏱️ Ceremony Timer">
      {phase === 'setup' ? (
        <>
          <Text style={f.fieldLabel}>SELECT CEREMONY</Text>
          <View style={tmr.presetGrid}>
            {CEREMONY_PRESETS.map(p => (
              <TouchableOpacity
                key={p.name}
                style={[tmr.presetCard, preset === p.name && tmr.presetCardActive]}
                onPress={() => { Haptics.selectionAsync(); setPreset(prev => prev === p.name ? null : p.name); setCustomMins(''); }}
                activeOpacity={0.75}
              >
                <Text style={tmr.presetEmoji}>{p.emoji}</Text>
                <Text style={[tmr.presetName, preset === p.name && tmr.presetNameActive]} numberOfLines={2}>{p.name}</Text>
                <Text style={[tmr.presetTime, preset === p.name && tmr.presetTimeActive]}>{p.minutes >= 60 ? `${p.minutes / 60}h` : `${p.minutes}m`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={f.fieldLabel}>OR CUSTOM DURATION (minutes)</Text>
          <TextInput
            style={f.input}
            value={customMins}
            onChangeText={v => { setCustomMins(v); setPreset(null); }}
            placeholder="e.g. 45"
            placeholderTextColor={Colors.grayDark}
            keyboardType="number-pad"
            maxLength={4}
          />
          <TouchableOpacity
            style={[f.submitBtn, !isReady && f.submitBtnDisabled]}
            onPress={handleStart}
            disabled={!isReady}
            activeOpacity={0.85}
          >
            <Text style={f.submitBtnText}>Start Timer →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </>
      ) : (
        <View style={tmr.timerFace}>
          {selectedPresetData && phase !== 'done' && (
            <Text style={tmr.ceremonyLabel}>{selectedPresetData.emoji} {selectedPresetData.name}</Text>
          )}
          <Text style={[tmr.countdown, phase === 'done' && tmr.countdownDone]}>
            {phase === 'done' ? "Time's up!" : fmt(timeLeft)}
          </Text>
          {phase !== 'done' && (
            <View style={tmr.progressBar}>
              <View style={[tmr.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
          )}
          {phase !== 'done' && (
            <Text style={tmr.timeRemaining}>
              {fmt(timeLeft)} remaining of {fmt(totalSecs)}
            </Text>
          )}
          <View style={tmr.controls}>
            {phase === 'running' && (
              <TouchableOpacity style={tmr.controlBtn} onPress={handlePause} activeOpacity={0.8}>
                <Text style={tmr.controlBtnText}>⏸ Pause</Text>
              </TouchableOpacity>
            )}
            {phase === 'paused' && (
              <TouchableOpacity style={[tmr.controlBtn, tmr.controlBtnPrimary]} onPress={handleResume} activeOpacity={0.8}>
                <Text style={[tmr.controlBtnText, tmr.controlBtnTextPrimary]}>▶ Resume</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={tmr.controlBtn} onPress={handleReset} activeOpacity={0.8}>
              <Text style={tmr.controlBtnText}>↺ Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const tmr = StyleSheet.create({
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  presetCard: {
    width: '30.5%', padding: 12, borderRadius: 12,
    backgroundColor: Colors.navyMid, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 4,
  },
  presetCardActive: { backgroundColor: Colors.tealDim, borderColor: Colors.teal },
  presetEmoji: { fontSize: 22 },
  presetName: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  presetNameActive: { color: Colors.tealLight },
  presetTime: { fontSize: 13, color: Colors.grayDark, fontWeight: '700' },
  presetTimeActive: { color: Colors.teal },
  timerFace: { alignItems: 'center', paddingVertical: 24, gap: 16 },
  ceremonyLabel: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  countdown: { fontSize: 72, fontWeight: '800', color: Colors.text, letterSpacing: -2, fontVariant: ['tabular-nums'] as any },
  countdownDone: { fontSize: 36, color: Colors.teal },
  progressBar: { width: '100%', height: 6, backgroundColor: Colors.navyMid, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.teal, borderRadius: 3 },
  timeRemaining: { fontSize: 13, color: Colors.grayDark },
  controls: { flexDirection: 'row', gap: 12, marginTop: 8 },
  controlBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.navyMid, borderWidth: 1, borderColor: Colors.border,
  },
  controlBtnPrimary: { backgroundColor: Colors.tealDim, borderColor: Colors.teal },
  controlBtnText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  controlBtnTextPrimary: { color: Colors.tealLight },
});

// ── Cert Prep ─────────────────────────────────────────────────────────────────

function CertPrepSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [cert, setCert] = useState('');
  const [mode, setMode] = useState('practice');

  const handleGenerate = () => {
    if (!cert) return;
    const certData = CERTS.find(c => c.id === cert)!;
    const modeData = STUDY_MODES.find(m => m.id === mode)!;

    const prompts: Record<string, string> = {
      practice: `Generate 5 realistic ${certData.name} (${certData.full}) exam-style practice questions.\n\nFor each question:\n1. Write a multiple-choice question with 4 options (A–D)\n2. Mark the correct answer\n3. Explain WHY each option is correct or incorrect, referencing the Scrum Guide or ${certData.org} framework\n4. Note the knowledge area this question tests\n\nMake the questions progressively harder. Focus on scenario-based questions that test understanding, not memorization.`,
      concept: `I'm studying for the ${certData.name} (${certData.full}) certification from ${certData.org}.\n\nPlease:\n1. List the 8–10 most important knowledge areas I must deeply understand to pass\n2. For each area: summarize the key concepts in 2–3 sentences\n3. Highlight the 3 most commonly misunderstood topics on this exam\n4. Recommend the top 3 resources or chapters to focus on\n5. Give me a 2-week study plan outline`,
      weak: `Quiz me on the most commonly failed topics for the ${certData.name} exam.\n\nPlease:\n1. List the top 5 areas where candidates most often fail the ${certData.name}\n2. For each area: give me 2 tricky questions that candidates frequently get wrong\n3. Reveal the correct answer with a thorough explanation\n4. Give a coaching tip for how to think about this topic correctly on exam day`,
      mock: `Run a 10-question mock ${certData.name} exam.\n\nFormat:\n- 10 scenario-based multiple-choice questions (A–D), numbered 1–10\n- Present ALL 10 questions first without answers\n- Then provide an answer key with full explanations for each\n- Score out of 10 and indicate which knowledge areas need more study\n- End with 3 targeted study recommendations based on the weak areas`,
    };

    const prompt = prompts[mode];
    const chatTitle = `${certData.name} — ${modeData.label}`;
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, chatTitle, t: Date.now().toString(), newChat: '1' } } as any);
    }, 300);
  };

  const reset = () => { setCert(''); setMode('practice'); };

  return (
    <Sheet visible={visible} onClose={() => { reset(); onClose(); }} title="🎓 Certification Prep">
      <Text style={f.fieldLabel}>CERTIFICATION *</Text>
      <View style={cert_s.certGrid}>
        {CERTS.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[cert_s.certCard, cert === c.id && cert_s.certCardActive]}
            onPress={() => { Haptics.selectionAsync(); setCert(prev => prev === c.id ? '' : c.id); }}
            activeOpacity={0.75}
          >
            <Text style={[cert_s.certName, cert === c.id && cert_s.certNameActive]}>{c.name}</Text>
            <Text style={[cert_s.certOrg, cert === c.id && cert_s.certOrgActive]}>{c.org}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={f.fieldLabel}>STUDY MODE</Text>
      {STUDY_MODES.map(m => (
        <TouchableOpacity
          key={m.id}
          style={[cert_s.modeRow, mode === m.id && cert_s.modeRowActive]}
          onPress={() => { Haptics.selectionAsync(); setMode(m.id); }}
          activeOpacity={0.75}
        >
          <View style={cert_s.modeText}>
            <Text style={[cert_s.modeLabel, mode === m.id && cert_s.modeLabelActive]}>{m.label}</Text>
            <Text style={cert_s.modeDesc}>{m.desc}</Text>
          </View>
          {mode === m.id && <Text style={cert_s.modeCheck}>✓</Text>}
        </TouchableOpacity>
      ))}
      <View style={{ height: 16 }} />
      <TouchableOpacity
        style={[f.submitBtn, !cert && f.submitBtnDisabled]}
        onPress={handleGenerate}
        disabled={!cert}
        activeOpacity={0.85}
      >
        <Text style={f.submitBtnText}>Start Study Session →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </Sheet>
  );
}

const cert_s = StyleSheet.create({
  certGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  certCard: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.navyMid, borderWidth: 1, borderColor: Colors.border,
    minWidth: '30%', alignItems: 'center',
  },
  certCardActive: { backgroundColor: Colors.tealDim, borderColor: Colors.teal },
  certName: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  certNameActive: { color: Colors.tealLight },
  certOrg: { fontSize: 10, color: Colors.grayDark, marginTop: 2 },
  certOrgActive: { color: Colors.teal },
  modeRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, marginBottom: 8,
    backgroundColor: Colors.navyMid, borderWidth: 1, borderColor: Colors.border,
  },
  modeRowActive: { backgroundColor: Colors.tealDim, borderColor: Colors.teal },
  modeText: { flex: 1 },
  modeLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
  modeLabelActive: { color: Colors.tealLight },
  modeDesc: { fontSize: 12, color: Colors.grayDark, lineHeight: 17 },
  modeCheck: { fontSize: 16, color: Colors.teal, fontWeight: '700', marginLeft: 8 },
});

// ── Tool card ─────────────────────────────────────────────────────────────────

function ToolCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={tc.icon}>{icon}</Text>
      <View style={tc.body}>
        <Text style={tc.title}>{title}</Text>
        <Text style={tc.desc}>{description}</Text>
      </View>
      <Text style={tc.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const tc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  icon: { fontSize: 28 },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  arrow: { fontSize: 22, color: Colors.grayDark, fontWeight: '300' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ToolsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 768;

  const [activeSheet, setActiveSheet] = useState<
    'sprint' | 'retro' | 'userstory' | 'standup' | 'refinement' | 'health' | 'pi' |
    'okr' | 'prioritize' | 'stakeholder' | 'roadmap' | 'research' |
    'timer' | 'certprep' | null
  >(null);

  const startCoachingSession = useCallback(() => {
    const prompt =
      "I'd like to start a coaching session. Begin by warmly asking me about my biggest Agile challenge right now. Ask 2–3 follow-up clarifying questions one at a time before you coach me. Don't lecture — make this a real coaching conversation where you draw out my thinking first.";
    router.navigate({ pathname: '/', params: { prompt, chatTitle: 'Coaching Session', t: Date.now().toString() } } as any);
  }, []);

  const openBoardAnalysis = useCallback(() => {
    router.navigate('/(tabs)/analyze' as any);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tools</Text>
        <Text style={styles.headerSub}>Structured Agile coaching flows</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, wide && styles.scrollWide]} showsVerticalScrollIndicator={false}>

        <Text style={styles.groupLabel}>GUIDED SESSIONS</Text>
        <ToolCard
          icon="🏃"
          title="Sprint Planner"
          description="Turn your sprint goal and team capacity into a focused AI-coached sprint plan"
          onPress={() => setActiveSheet('sprint')}
        />
        <ToolCard
          icon="🔄"
          title="Retro Facilitator"
          description="Prepare a structured retrospective with questions, timebox, and action item guidance"
          onPress={() => setActiveSheet('retro')}
        />
        <ToolCard
          icon="📝"
          title="User Story Workshop"
          description="Generate well-formed user stories with acceptance criteria for any feature or epic"
          onPress={() => setActiveSheet('userstory')}
        />
        <ToolCard
          icon="☀️"
          title="Daily Standup Prep"
          description="Frame a focused standup update and get coaching on surfacing blockers effectively"
          onPress={() => setActiveSheet('standup')}
        />
        <ToolCard
          icon="📋"
          title="Backlog Refinement"
          description="Get a Definition of Ready check, splitting suggestions, and complexity estimates"
          onPress={() => setActiveSheet('refinement')}
        />
        <ToolCard
          icon="❤️"
          title="Team Health Check"
          description="Diagnose team health across 8 Agile dimensions with facilitation guidance"
          onPress={() => setActiveSheet('health')}
        />
        <ToolCard
          icon="🗓️"
          title="PI Planning"
          description="Plan your SAFe Program Increment with agenda, objectives, and ROAM risk guidance"
          onPress={() => setActiveSheet('pi')}
        />

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>PRODUCT MANAGEMENT</Text>
        <ToolCard
          icon="🎯"
          title="OKR Builder"
          description="Define compelling Objectives and measurable Key Results with AI guidance"
          onPress={() => setActiveSheet('okr')}
        />
        <ToolCard
          icon="⚖️"
          title="Feature Prioritization"
          description="Score your backlog with RICE, MoSCoW, Kano, or weighted frameworks"
          onPress={() => setActiveSheet('prioritize')}
        />
        <ToolCard
          icon="📣"
          title="Stakeholder Update"
          description="Generate clear, outcome-led product updates for any audience"
          onPress={() => setActiveSheet('stakeholder')}
        />
        <ToolCard
          icon="🗺️"
          title="Roadmap Builder"
          description="Shape a product roadmap narrative with outcome themes and sequencing logic"
          onPress={() => setActiveSheet('roadmap')}
        />
        <ToolCard
          icon="🔬"
          title="Research Synthesis"
          description="Turn raw user feedback and data into patterns, insights, and product actions"
          onPress={() => setActiveSheet('research')}
        />

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>CERTIFICATION PREP</Text>
        <ToolCard
          icon="🎓"
          title="Cert Prep"
          description="Practice questions, concept review, and mock exams for PSM, PSPO, SAFe, and more"
          onPress={() => setActiveSheet('certprep')}
        />

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>UTILITIES</Text>
        <ToolCard
          icon="⏱️"
          title="Ceremony Timer"
          description="Timebox your standups, planning, retros, and refinement sessions"
          onPress={() => setActiveSheet('timer')}
        />

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>1-ON-1 COACHING</Text>
        <ToolCard
          icon="🧑‍💼"
          title="Coaching Session"
          description="AgileCoachIQ asks YOU questions first, then coaches you through your toughest challenge"
          onPress={startCoachingSession}
        />

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>ANALYSIS</Text>
        <ToolCard
          icon="📸"
          title="Board Analysis"
          description="Upload a screenshot of your Jira or Kanban board for AI coaching feedback"
          onPress={openBoardAnalysis}
        />

        <View style={{ height: 24 }} />
      </ScrollView>

      <SprintPlannerSheet visible={activeSheet === 'sprint'} onClose={() => setActiveSheet(null)} />
      <RetroSheet visible={activeSheet === 'retro'} onClose={() => setActiveSheet(null)} />
      <UserStorySheet visible={activeSheet === 'userstory'} onClose={() => setActiveSheet(null)} />
      <DailyStandupSheet visible={activeSheet === 'standup'} onClose={() => setActiveSheet(null)} />
      <BacklogRefinementSheet visible={activeSheet === 'refinement'} onClose={() => setActiveSheet(null)} />
      <TeamHealthSheet visible={activeSheet === 'health'} onClose={() => setActiveSheet(null)} />
      <PIPlanningSheet visible={activeSheet === 'pi'} onClose={() => setActiveSheet(null)} />
      <OKRBuilderSheet visible={activeSheet === 'okr'} onClose={() => setActiveSheet(null)} />
      <FeaturePrioritizationSheet visible={activeSheet === 'prioritize'} onClose={() => setActiveSheet(null)} />
      <StakeholderUpdateSheet visible={activeSheet === 'stakeholder'} onClose={() => setActiveSheet(null)} />
      <ProductRoadmapSheet visible={activeSheet === 'roadmap'} onClose={() => setActiveSheet(null)} />
      <ResearchSynthesisSheet visible={activeSheet === 'research'} onClose={() => setActiveSheet(null)} />
      <CeremonyTimerSheet visible={activeSheet === 'timer'} onClose={() => setActiveSheet(null)} />
      <CertPrepSheet visible={activeSheet === 'certprep'} onClose={() => setActiveSheet(null)} />
    </SafeAreaView>
  );
}

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
  scroll: { padding: 16 },
  scrollWide: { maxWidth: 680, alignSelf: 'center', width: '100%' },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },
});
