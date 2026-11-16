import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { AppCard, BrandButton } from '../ui';
import { FITNESS_MODULES } from '../../data/fitnessData';
import { navigateToFitnessModule } from '../../utils/fitnessModuleRouter';

type Level = 'tight' | 'okay' | 'easy';

type Check = {
  id: string;
  title: string;
  how: string;
  stretch: string;
};

const CHECKS: Check[] = [
  {
    id: 'hamstrings',
    title: 'Hamstrings',
    how: 'Sit tall with both legs straight. Reach toward your toes without bouncing.',
    stretch: 'Sit tall, one leg long, and hinge from the hips for 30 seconds each side.',
  },
  {
    id: 'shoulders',
    title: 'Shoulders',
    how: 'Reach one hand up your back and the other down behind your head. How close are the fingers?',
    stretch: 'Hold a towel behind your back and gently walk the hands toward each other, 30 seconds each side.',
  },
  {
    id: 'ankles',
    title: 'Ankles',
    how: 'Stand a fist-width from a wall. Can the knee touch the wall with the heel staying down?',
    stretch: 'Rock the knee toward the wall with the heel down, 10 slow reps each side.',
  },
  {
    id: 'hips',
    title: 'Hips',
    how: 'Sit cross-legged, or rest one ankle on the opposite knee. Does one hip stop you?',
    stretch: 'Half-kneel and tuck the pelvis slightly, then shift forward until you feel the front of the hip. Hold 30 seconds each side.',
  },
  {
    id: 'upper-back',
    title: 'Upper back',
    how: 'Sit tall and turn to look behind you. How far does your chest turn, not just your neck?',
    stretch: 'Lie on your side, knees bent, and open the top arm across the chest. Hold 30 seconds each side.',
  },
];

const LEVELS: { id: Level; label: string; score: number }[] = [
  { id: 'tight', label: 'Tight', score: 0 },
  { id: 'okay', label: 'Okay', score: 1 },
  { id: 'easy', label: 'Easy', score: 2 },
];

const STORAGE_KEY = 'flexibilityCheckLatest';

type Saved = {
  answers: Partial<Record<string, Level>>;
  savedAt: string;
};

function scoreOf(answers: Partial<Record<string, Level>>) {
  return CHECKS.reduce((sum, check) => {
    const level = answers[check.id];
    return sum + (LEVELS.find((item) => item.id === level)?.score ?? 0);
  }, 0);
}

function tightest(answers: Partial<Record<string, Level>>): Check {
  const ranked = [...CHECKS].sort((a, b) => {
    const av = LEVELS.find((item) => item.id === answers[a.id])?.score ?? 0;
    const bv = LEVELS.find((item) => item.id === answers[b.id])?.score ?? 0;
    return av - bv;
  });
  return ranked[0];
}

function summary(total: number, focus: string) {
  if (total >= 8) {
    return `You move well for daily life. Keep ${focus.toLowerCase()} easy with a short stretch after you have been sitting.`;
  }
  if (total >= 5) {
    return `${focus} is the area holding you back. Four short sessions this week will change it more than one long stretch.`;
  }
  return `Stiffness is getting in the way of ordinary movement. Start with ${focus.toLowerCase()} for eight minutes on four days, and stop if a move is sharp.`;
}

export default function FlexibilityCheck({ accent }: { accent: string }) {
  const navigation = useNavigation<any>();
  const [answers, setAnswers] = useState<Partial<Record<string, Level>>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Saved;
        if (saved.answers) {
          setAnswers(saved.answers);
          setSavedAt(saved.savedAt);
        }
      } catch {
        // Ignore a bad saved check.
      }
    }).catch(() => {});
  }, []);

  const answered = CHECKS.every((check) => answers[check.id]);
  const total = scoreOf(answers);
  const focus = tightest(answers);

  const save = async () => {
    const payload: Saved = { answers, savedAt: new Date().toISOString() };
    setSavedAt(payload.savedAt);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const openStretching = () => {
    const module = FITNESS_MODULES.find((item) => item.id === 'stretching');
    if (module) navigateToFitnessModule(navigation, module);
  };

  return (
    <AppCard style={styles.card}>
      <Text style={styles.kicker}>Your check</Text>
      <Text style={styles.lead}>
        Five moves. Mark how each one feels. You will get a score and the one stretch worth doing today.
      </Text>

      {CHECKS.map((check, index) => (
        <View key={check.id} style={styles.block}>
          <Text style={styles.step}>{index + 1}. {check.title}</Text>
          <Text style={styles.how}>{check.how}</Text>
          <View style={styles.choices}>
            {LEVELS.map((level) => {
              const on = answers[check.id] === level.id;
              return (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.choice, on && { backgroundColor: accent, borderColor: accent }]}
                  onPress={() => setAnswers((prev) => ({ ...prev, [check.id]: level.id }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{level.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {answered ? (
        <View style={styles.result}>
          <Text style={styles.score}>{total}/10</Text>
          <Text style={styles.resultTitle}>Focus on {focus.title.toLowerCase()}</Text>
          <Text style={styles.resultBody}>{summary(total, focus.title)}</Text>
          <Text style={styles.stretchLabel}>Today</Text>
          <Text style={styles.stretch}>{focus.stretch}</Text>
          <BrandButton label={savedAt ? 'Update my result' : 'Save my result'} onPress={save} />
          <TouchableOpacity onPress={openStretching} accessibilityRole="button">
            <Text style={[styles.link, { color: accent }]}>Open Stretching Routines</Text>
          </TouchableOpacity>
          {savedAt ? (
            <Text style={styles.saved}>
              Saved {new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Retake it in two weeks.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>Answer all five to see your score.</Text>
      )}

      <Text style={styles.note}>
        Stop if a move is sharply painful. This is a self-check, not a diagnosis or a physio assessment.
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  kicker: {
    fontSize: Typography.size.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  lead: {
    fontSize: Typography.size.base,
    color: Colors.text,
    lineHeight: 22,
  },
  block: { gap: 6 },
  step: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.text },
  how: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 20 },
  choices: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  choiceText: { fontSize: Typography.size.xs, fontWeight: '700', color: Colors.textSecondary },
  choiceTextOn: { color: Colors.white },
  result: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
  },
  score: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  resultTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  resultBody: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 20 },
  stretchLabel: {
    marginTop: 4,
    fontSize: Typography.size.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stretch: { fontSize: Typography.size.sm, color: Colors.text, lineHeight: 20 },
  link: { fontSize: Typography.size.sm, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  saved: { fontSize: Typography.size.xs, color: Colors.textTertiary, textAlign: 'center' },
  hint: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  note: { fontSize: Typography.size.xs, color: Colors.textTertiary, lineHeight: 18 },
});
