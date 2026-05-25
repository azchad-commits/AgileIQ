import React, { useState, useCallback } from 'react';
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

const RETRO_FORMATS = ['Start/Stop/Continue', '4Ls', 'Mad/Sad/Glad', 'Rose/Thorn/Bud', 'ORID'];
const RETRO_TIMES = ['30 min', '45 min', '60 min', '90 min'];
const STORY_COUNTS = ['3', '5', '8', '10'];

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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, t: Date.now().toString(), newChat: '1' } } as any);
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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, t: Date.now().toString(), newChat: '1' } } as any);
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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt, t: Date.now().toString(), newChat: '1' } } as any);
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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), t: Date.now().toString(), newChat: '1' } } as any);
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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), t: Date.now().toString(), newChat: '1' } } as any);
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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), t: Date.now().toString(), newChat: '1' } } as any);
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
    reset();
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: '/', params: { prompt: parts.join(''), t: Date.now().toString(), newChat: '1' } } as any);
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
  const [activeSheet, setActiveSheet] = useState<'sprint' | 'retro' | 'userstory' | 'standup' | 'refinement' | 'health' | 'pi' | null>(null);

  const startCoachingSession = useCallback(() => {
    const prompt =
      "I'd like to start a coaching session. Begin by warmly asking me about my biggest Agile challenge right now. Ask 2–3 follow-up clarifying questions one at a time before you coach me. Don't lecture — make this a real coaching conversation where you draw out my thinking first.";
    router.navigate({ pathname: '/', params: { prompt, t: Date.now().toString() } } as any);
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>1-ON-1 COACHING</Text>
        <ToolCard
          icon="🎯"
          title="Coaching Session"
          description="AgileIQ asks YOU questions first, then coaches you through your toughest challenge"
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
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.grayDark,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },
});
