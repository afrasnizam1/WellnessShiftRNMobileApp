import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, Shadow, tabBarScrollPadding } from '../../theme';
import { Screen } from '../../navigation/screenNames';
import AppScreen from '../common/AppScreen';
import { BrandButton } from '../ui';
import type { IoniconName } from '../../theme/icons';

type Tool = {
  id: string;
  name: string;
  minutes: string;
  forFeeling: string;
  why: string;
  steps: string[];
  icon: IoniconName;
};

const TOOLS: Tool[] = [
  {
    id: 'ground',
    name: '5-4-3-2-1',
    minutes: '2 min',
    forFeeling: 'Anxious or spun out',
    why: 'Naming what your senses notice pulls attention out of the worry loop.',
    icon: 'eye-outline',
    steps: [
      'Look around and name 5 things you can see. Say them quietly.',
      'Name 4 things you can feel: clothes, chair, feet on the floor, air on your skin.',
      'Name 3 sounds, including quiet ones.',
      'Name 2 smells, or two things you could smell if you leaned closer.',
      'Name 1 taste, or take one slow sip of water and notice it.',
    ],
  },
  {
    id: 'stop',
    name: 'STOP',
    minutes: '1 min',
    forFeeling: 'About to react',
    why: 'A pause before you reply, scroll, or decide when you are already tense.',
    icon: 'hand-left-outline',
    steps: [
      'Stop. Put the phone down or take your hands off the keyboard.',
      'Take one breath in, and a longer breath out.',
      'Observe: what is the feeling, and what do you actually need in the next minute?',
      'Proceed with one small action. Not the whole problem.',
    ],
  },
  {
    id: 'scan',
    name: 'Body scan',
    minutes: '60 sec',
    forFeeling: 'Tight jaw, shoulders, or chest',
    why: 'Stress sits in the body first. Softening one area often drops the rest.',
    icon: 'body-outline',
    steps: [
      'Feet. Notice them on the floor. Unclench the toes.',
      'Belly. Let it soften on the exhale. You do not need to hold it in.',
      'Shoulders. Drop them away from the ears.',
      'Jaw. Leave a small gap between the teeth. Unstick the tongue from the roof of the mouth.',
    ],
  },
  {
    id: 'kind',
    name: 'One kind line',
    minutes: '1 min',
    forFeeling: 'Hard on yourself',
    why: 'A short phrase interrupts the critic without pretending the problem is gone.',
    icon: 'heart-outline',
    steps: [
      'Name what is hard in one sentence. No essay.',
      'Say, quietly: “This is a hard moment. I can be decent to myself in it.”',
      'Add one practical kindness: water, a walk to the door, or closing one tab.',
    ],
  },
  {
    id: 'sleep',
    name: 'Longer exhale',
    minutes: '3 min',
    forFeeling: 'Wired at bedtime',
    why: 'A longer out-breath tells the body the day is allowed to end.',
    icon: 'moon-outline',
    steps: [
      'Lie down or sit. Lights low.',
      'Breathe in through the nose for a count of 4.',
      'Breathe out for a count of 6. Lips soft.',
      'Repeat for eight breaths. If the mind runs, come back to the count.',
    ],
  },
];

const FEELINGS: { label: string; toolId: string }[] = [
  { label: 'Anxious', toolId: 'ground' },
  { label: 'About to snap', toolId: 'stop' },
  { label: 'Tense', toolId: 'scan' },
  { label: 'Self-critical', toolId: 'kind' },
  { label: 'Can’t sleep', toolId: 'sleep' },
];

export default function MindfulnessToolkit() {
  const navigation = useNavigation<any>();
  const [toolId, setToolId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const tool = TOOLS.find((item) => item.id === toolId) ?? null;
  const done = tool != null && step >= tool.steps.length;

  const openTool = (id: string) => {
    setToolId(id);
    setStep(0);
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (tool ? openTool('') || setToolId(null) : navigation.goBack())}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tool ? tool.name : 'Mindfulness Toolkit'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!tool ? (
          <>
            <Text style={styles.lead}>
              Pick what you feel right now. You’ll get one short practice, not a lecture.
            </Text>
            <View style={styles.feelingRow}>
              {FEELINGS.map((feeling) => (
                <TouchableOpacity
                  key={feeling.label}
                  style={styles.feeling}
                  onPress={() => openTool(feeling.toolId)}
                  accessibilityRole="button"
                >
                  <Text style={styles.feelingText}>{feeling.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.section}>Or choose a tool</Text>
            {TOOLS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.toolCard}
                onPress={() => openTool(item.id)}
                accessibilityRole="button"
              >
                <View style={styles.toolIcon}>
                  <Ionicons name={item.icon} size={20} color={Colors.mental} />
                </View>
                <View style={styles.toolText}>
                  <Text style={styles.toolName}>{item.name}</Text>
                  <Text style={styles.toolMeta}>{item.forFeeling} · {item.minutes}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        ) : done ? (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>That’s the practice.</Text>
            <Text style={styles.doneBody}>
              You don’t need to feel different. You interrupted the spiral. Use the same tool the next time this feeling shows up.
            </Text>
            <BrandButton label="Back to the toolkit" onPress={() => setToolId(null)} />
            <TouchableOpacity
              onPress={() => navigation.navigate(Screen.breathingExercise)}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Open a longer breathing session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.practice}>
            <Text style={styles.practiceMeta}>{tool.forFeeling} · {tool.minutes}</Text>
            <Text style={styles.why}>{tool.why}</Text>
            <View style={styles.stepCard}>
              <Text style={styles.stepCount}>Step {step + 1} of {tool.steps.length}</Text>
              <Text style={styles.stepText}>{tool.steps[step]}</Text>
            </View>
            <BrandButton
              label={step + 1 === tool.steps.length ? 'Finish' : 'Next'}
              onPress={() => setStep((value) => value + 1)}
            />
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: tabBarScrollPadding },
  lead: { fontSize: Typography.size.base, color: Colors.text, lineHeight: 22 },
  feelingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  feeling: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feelingText: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.text },
  section: {
    marginTop: Spacing.sm,
    fontSize: Typography.size.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EEFF',
  },
  toolText: { flex: 1 },
  toolName: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  toolMeta: { fontSize: Typography.size.xs, color: Colors.textSecondary, marginTop: 2 },
  practice: { gap: Spacing.md },
  practiceMeta: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.mental },
  why: { fontSize: Typography.size.base, color: Colors.text, lineHeight: 22 },
  stepCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  stepCount: {
    fontSize: Typography.size.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stepText: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.text, lineHeight: 28 },
  doneCard: { gap: Spacing.md, paddingTop: Spacing.lg },
  doneTitle: { fontSize: Typography.size.xl, fontWeight: '800', color: Colors.text },
  doneBody: { fontSize: Typography.size.base, color: Colors.textSecondary, lineHeight: 22 },
  link: { textAlign: 'center', color: Colors.mental, fontWeight: '700', fontSize: Typography.size.sm },
});
