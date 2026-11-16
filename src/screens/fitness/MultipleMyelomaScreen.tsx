import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, tabBarScrollPadding } from '../../theme';
import { ScreenHeader } from '../../components/ui';
import AppScreen from '../../components/common/AppScreen';

const FRAME = require('../../assets/anatomy/multiple-myeloma.png');

type Question = {
  prompt: string;
  options: string[];
  answer: number;
  why: string;
};

const QUESTIONS: Question[] = [
  {
    prompt: 'Multiple myeloma is a cancer of which cells?',
    options: ['Plasma cells in the bone marrow', 'Skin cells', 'Air sacs in the lung'],
    answer: 0,
    why: 'Plasma cells are a type of white blood cell. They normally live in the bone marrow and make antibodies. Myeloma is when those cells grow out of control there.',
  },
  {
    prompt: 'What do healthy plasma cells mainly do?',
    options: ['Make antibodies that help fight infection', 'Carry oxygen', 'Clot the blood'],
    answer: 0,
    why: 'Antibodies are proteins that help the body recognise germs. Red blood cells carry oxygen. Platelets help blood clot.',
  },
  {
    prompt: 'In the picture, the red discs are closest to which cells?',
    options: ['Red blood cells', 'Bacteria', 'Nerve cells'],
    answer: 0,
    why: 'The white lattice suggests the spongy structure of bone. The red discs stand in for red blood cells moving through it. The larger amber cells suggest plasma cells. It is a teaching picture, not a scan.',
  },
  {
    prompt: 'Which of these is a reason to talk to a doctor?',
    options: [
      'Bone pain that does not settle, unusual tiredness, or infections that keep coming back',
      'One night of poor sleep',
      'A bruise after you knock your arm',
    ],
    answer: 0,
    why: 'Those symptoms have many causes, and most people with them do not have myeloma. They are still worth a GP appointment. Only blood tests, urine tests, and sometimes a bone marrow sample can look for this cancer.',
  },
];

export default function MultipleMyelomaScreen() {
  const navigation = useNavigation<any>();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const question = QUESTIONS[index];
  const revealed = picked !== null;

  const choose = (option: number) => {
    if (revealed) return;
    setPicked(option);
    if (option === question.answer) setScore((n) => n + 1);
  };

  const next = () => {
    if (index + 1 >= QUESTIONS.length) {
      setDone(true);
      return;
    }
    setIndex((n) => n + 1);
    setPicked(null);
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  };

  return (
    <AppScreen style={styles.safe}>
      <ScreenHeader
        title="Multiple myeloma"
        subtitle="A short knowledge check"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.frame}>
          <Image source={FRAME} style={styles.frameImage} resizeMode="cover" accessibilityLabel="Bone marrow illustration with a white lattice, red blood cells, and larger amber cells." />
        </View>

        <View style={styles.fact}>
          <Text style={styles.factTitle}>What the picture is showing</Text>
          <Text style={styles.factBody}>
            The lattice is the spongy inside of bone, where bone marrow lives. Red discs stand in for red blood cells. The larger amber cells stand in for plasma cells, the cells involved in multiple myeloma. This is a still from an animation, not a picture of your bone marrow.
          </Text>
        </View>

        <View style={styles.fact}>
          <Text style={styles.factTitle}>In one paragraph</Text>
          <Text style={styles.factBody}>
            Multiple myeloma is a blood cancer. Plasma cells build up in the marrow and can crowd out healthy blood cells, weaken bone, and affect the kidneys. It is more common later in life. Feeling tired or achy does not mean you have it.
          </Text>
        </View>

        {done ? (
          <View style={styles.fact}>
            <Text style={styles.factTitle}>
              {score} of {QUESTIONS.length}
            </Text>
            <Text style={styles.factBody}>
              {score === QUESTIONS.length
                ? 'You matched each answer. This still does not say anything about your own health.'
                : 'The notes under each question are the part worth keeping. You can run the check again.'}
            </Text>
            <Pressable onPress={restart} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>Try the check again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.fact}>
            <Text style={styles.progress}>
              Question {index + 1} of {QUESTIONS.length}
            </Text>
            <Text style={styles.prompt}>{question.prompt}</Text>
            {question.options.map((option, optionIndex) => {
              const selected = picked === optionIndex;
              const correct = revealed && optionIndex === question.answer;
              const wrong = revealed && selected && optionIndex !== question.answer;
              return (
                <Pressable
                  key={option}
                  onPress={() => choose(optionIndex)}
                  style={[styles.option, correct && styles.optionCorrect, wrong && styles.optionWrong]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              );
            })}
            {revealed ? (
              <>
                <Text style={styles.why}>{question.why}</Text>
                <Pressable onPress={next} style={styles.primary} accessibilityRole="button">
                  <Text style={styles.primaryText}>
                    {index + 1 === QUESTIONS.length ? 'See your score' : 'Next question'}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        <Text style={styles.disclaimer}>
          Education only — not a diagnosis or a screening result. A quiz cannot tell you whether you have multiple myeloma. If you are worried about bone pain, tiredness, repeated infections, or a change in how often you pass urine, speak to your GP. In an emergency call 999. For urgent but non-life-threatening concerns in the UK, use NHS 111.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: tabBarScrollPadding,
  },
  frame: {
    width: '100%',
    height: 220,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#F4E6DC',
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  fact: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  factTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  factBody: { fontSize: Typography.size.sm, lineHeight: 21, color: Colors.textSecondary },
  progress: {
    fontSize: Typography.size.xs,
    fontWeight: '700',
    color: '#C2412D',
    letterSpacing: 0.3,
  },
  prompt: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 24,
  },
  option: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
  },
  optionCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  optionWrong: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },
  optionText: {
    fontSize: Typography.size.sm,
    lineHeight: 20,
    color: Colors.text,
  },
  why: {
    fontSize: Typography.size.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  primary: {
    marginTop: Spacing.xs,
    backgroundColor: '#E85A4F',
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Typography.size.sm,
  },
  disclaimer: {
    fontSize: Typography.size.xs,
    lineHeight: 18,
    color: Colors.textTertiary,
  },
});
