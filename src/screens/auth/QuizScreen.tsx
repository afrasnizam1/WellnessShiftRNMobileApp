// src/screens/auth/QuizScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, WELLNESS_CATEGORIES } from '../../theme';
import { useAppStore } from '../../store';
import { wellnessService, userService } from '../../services/firebase';
import { ensureAuthReadyForUid } from '../../services/firebaseReady';
import { onboardingStorage } from '../../services/onboardingStorage';
import AppScreen from '../../components/common/AppScreen';
import { AnimatedPressable } from '../../components/ui';
import {
  getAssessmentQuestions,
  type AssessmentQuestion,
} from '../../data/wellnessAssessmentQuestions';
import {
  computeWellnessScoreFromAnswers,
  mergeAssessmentAnswers,
  type AssessmentAnswerMap,
} from '../../utils/wellnessAssessmentScoring';
import { computeBiologicalAge } from '../../utils/biologicalAge';
import { pendingOnboardingStorage } from '../../services/pendingOnboardingStorage';
import { Screen } from '../../navigation/screenNames';
import {
  goBackOrTo,
  goToBuildingWellnessPlan,
  refreshPreAuthRouteFromPending,
  resumePreAuthOnboardingFromPending,
} from '../../services/onboardingNavigation';
import type { RootStackParamList, WellnessScore } from '../../types';

const ADVANCE_DELAY_MS = 280;

function formatOverall(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatAge(age: number): string {
  return Number.isInteger(age) ? String(age) : age.toFixed(1);
}

function weakestDroppedCategory(
  previous: WellnessScore,
  next: WellnessScore,
): string | null {
  let worstKey: string | null = null;
  let worstDelta = 0;
  (Object.keys(next.categories) as Array<keyof WellnessScore['categories']>).forEach((key) => {
    const delta = (next.categories[key] ?? 0) - (previous.categories[key] ?? next.categories[key] ?? 0);
    if (delta < worstDelta) {
      worstDelta = delta;
      worstKey = key;
    }
  });
  if (!worstKey || worstDelta > -0.3) return null;
  return WELLNESS_CATEGORIES.find((c) => c.key === worstKey)?.label ?? null;
}

function deeperResultAlert(
  previous: WellnessScore,
  next: WellnessScore,
  dateOfBirth?: string,
  heightCm?: number,
  weightKg?: number,
): { title: string; message: string } {
  const from = formatOverall(previous.overall);
  const to = formatOverall(next.overall);
  const delta = Math.round((next.overall - previous.overall) * 10) / 10;

  let title: string;
  let message: string;
  if (delta >= 0.1) {
    title = 'Great, your score improved';
    message = `Your wellness score went from ${from} to ${to}. The extra 10 questions lifted it. Keep that going.`;
  } else if (delta <= -0.1) {
    title = 'Your score went down';
    const weak = weakestDroppedCategory(previous, next);
    message = `Your wellness score went from ${from} to ${to}. That's not what we wanted, but these extra answers are a more accurate picture.${
      weak ? ` ${weak} pulled it down the most.` : ''
    } Work those weaker areas and you can bring it back up.`;
  } else {
    title = 'Your score held steady';
    message = `Your wellness score is still ${to} (was ${from}). The extra 10 questions confirmed your first result. Small habit wins will move it.`;
  }

  const prevBio = dateOfBirth
    ? computeBiologicalAge({ dateOfBirth, wellnessScore: previous, heightCm, weightKg })
    : null;
  const nextBio = dateOfBirth
    ? computeBiologicalAge({ dateOfBirth, wellnessScore: next, heightCm, weightKg })
    : null;
  if (prevBio && nextBio) {
    const ageFrom = formatAge(prevBio.biologicalAge);
    const ageTo = formatAge(nextBio.biologicalAge);
    if (nextBio.biologicalAge < prevBio.biologicalAge) {
      message += `\n\nBiological age improved from ${ageFrom} to ${ageTo}. That's a win.`;
    } else if (nextBio.biologicalAge > prevBio.biologicalAge) {
      message += `\n\nBiological age went from ${ageFrom} to ${ageTo}.`;
    }
  }

  return { title, message };
}

export default function QuizScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, typeof Screen.wellnessQuiz>>();
  const { user, setWellnessScore, setLastQuizAnswers, setUser, hasSeenIntro } = useAppStore();
  const isDeeper =
    route.params?.mode === 'deeper' ||
    (!!user?.onboardingComplete && route.params?.mode !== 'onboarding');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(
    getAssessmentQuestions(isDeeper ? 'deeper' : 'onboarding'),
  );
  const [questionsReady, setQuestionsReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const previousAnswersRef = useRef<AssessmentAnswerMap>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Guest-only resume: never teleport signed-in users into the create-account stack.
      if (!user) {
        const resumed = await resumePreAuthOnboardingFromPending(navigation, hasSeenIntro);
        if (cancelled || resumed === 'handled') return;
      }

      const questionSet = isDeeper ? 'deeper' : 'onboarding';
      if (!isDeeper) {
        const pending = await pendingOnboardingStorage.get();
        if (cancelled) return;
        if (pending.assessmentPath !== 'full') {
          await pendingOnboardingStorage.saveAssessmentPath('full');
          if (cancelled) return;
        }
      } else {
        const pending = await pendingOnboardingStorage.get();
        const stored = user ? await onboardingStorage.getQuizAnswers(user.uid) : null;
        const inMemory = useAppStore.getState().lastQuizAnswers;
        previousAnswersRef.current =
          inMemory ?? stored ?? user?.quizAnswers ?? pending.quizAnswers ?? {};
        if (!inMemory && Object.keys(previousAnswersRef.current).length > 0) {
          setLastQuizAnswers(previousAnswersRef.current);
        }
      }
      if (cancelled) return;
      setQuestions(getAssessmentQuestions(questionSet));
      setQuestionsReady(true);
    })();
    return () => { cancelled = true; };
  }, [navigation, user, hasSeenIntro, isDeeper, setLastQuizAnswers]);

  const TOTAL = questions.length;
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  const safeIndex = TOTAL > 0 ? Math.min(Math.max(currentIndex, 0), TOTAL - 1) : 0;
  const q = questions[safeIndex];
  const progress = TOTAL > 0 ? (safeIndex + 1) / TOTAL : 0;
  const cat = q ? WELLNESS_CATEGORIES.find((c) => c.key === q.category) : undefined;
  const selectedScore = q ? answers[q.id] : undefined;
  const inputLocked = saving || advancing;

  const persistResults = async (
    score: ReturnType<typeof computeWellnessScoreFromAnswers>,
    merged: AssessmentAnswerMap,
  ) => {
    if (!user) return;
    const profilePatch = {
      quizComplete: true,
      quizAnswers: merged,
      ...(isDeeper ? { deeperCheckInComplete: true } : {}),
    };
    await onboardingStorage.saveQuizAnswers(user.uid, merged);
    await onboardingStorage.markQuizComplete(user.uid);
    if (isDeeper) {
      await onboardingStorage.markDeeperCheckInComplete(user.uid);
    }
    setUser({ ...user, ...profilePatch });
    try {
      await ensureAuthReadyForUid(user.uid);
      await wellnessService.saveScore(user.uid, score);
      await userService.updateProfile(user.uid, profilePatch);
    } catch (error) {
      console.warn('[QuizScreen] persistResults remote failed:', error);
    }
  };

  const finishQuiz = async (finalAnswers: Record<string, number>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setAdvancing(false);

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const merged = isDeeper
      ? mergeAssessmentAnswers(previousAnswersRef.current, finalAnswers)
      : finalAnswers;
    const score = computeWellnessScoreFromAnswers(merged);
    const previousScore = isDeeper
      ? (Object.keys(previousAnswersRef.current).length > 0
          ? computeWellnessScoreFromAnswers(previousAnswersRef.current)
          : useAppStore.getState().wellnessScore)
      : null;
    setWellnessScore(score);
    setLastQuizAnswers(merged);

    const showDeeperScorePopup = () => {
      const comparison = previousScore
        ? deeperResultAlert(
            previousScore,
            score,
            user?.dateOfBirth,
            user?.heightCm,
            user?.weightKg,
          )
        : {
            title: 'Score updated',
            message: `Your wellness score is now ${formatOverall(score.overall)} from all 20 questions.`,
          };
      Alert.alert(comparison.title, comparison.message, [
        {
          text: 'OK',
          onPress: () => goBackOrTo(navigation, Screen.patientApp),
        },
      ]);
    };

    try {
      if (isDeeper) {
        await persistResults(score, merged);
        savingRef.current = false;
        setSaving(false);
        showDeeperScorePopup();
        return;
      }

      await pendingOnboardingStorage.saveQuiz(score, merged);

      if (user) {
        await persistResults(score, merged);
      }

      // Guest and signed-in: 3s building interstitial, then Results.
      await refreshPreAuthRouteFromPending(hasSeenIntro);
      goToBuildingWellnessPlan(navigation);

      savingRef.current = false;
      setSaving(false);
    } catch (error) {
      console.warn('[QuizScreen] finishQuiz failed:', error);
      savingRef.current = false;
      setSaving(false);
      if (isDeeper) {
        persistResults(score, merged).catch(() => {});
        showDeeperScorePopup();
        return;
      }
      Alert.alert(
        'Could not save your results',
        'Your answers were scored locally. You can continue.',
        [
          {
            text: 'Continue',
            onPress: async () => {
              pendingOnboardingStorage.saveQuiz(score, merged).catch(() => {});
              persistResults(score, merged).catch(() => {});
              refreshPreAuthRouteFromPending(hasSeenIntro).catch(() => {});
              goToBuildingWellnessPlan(navigation);
            },
          },
        ],
      );
    }
  };

  const handleAnswer = (optionScore: number) => {
    if (inputLocked || savingRef.current || !q) return;

    const answeredIndex = indexRef.current;
    const newAnswers = { ...answers, [q.id]: optionScore };
    setAnswers(newAnswers);

    if (answeredIndex < TOTAL - 1) {
      setAdvancing(true);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        setCurrentIndex((i) => Math.min(i + 1, TOTAL - 1));
        setAdvancing(false);
      }, ADVANCE_DELAY_MS);
      return;
    }

    finishQuiz(newAnswers);
  };

  const leaveDeeper = () => {
    if (inputLocked) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
      setAdvancing(false);
    }
    goBackOrTo(navigation, Screen.patientApp);
  };

  const handleBack = () => {
    if (inputLocked) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
      setAdvancing(false);
    }
    if (currentIndex > 0) {
      setCurrentIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (isDeeper) {
      leaveDeeper();
      return;
    }
    // The quiz is often the first screen in the stack, so goBack() has nowhere to go.
    goBackOrTo(navigation, Screen.purposeSelection);
  };

  if (!questionsReady || !q) {
    return (
      <AppScreen style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </AppScreen>
    );
  }

  if (saving) {
    return (
      <AppScreen style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {isDeeper ? 'Updating your score…' : 'Saving your results…'}
        </Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.safe}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: cat?.color ?? Colors.primary }]} />
      </View>

      <View style={styles.header}>
        <AnimatedPressable
          onPress={handleBack}
          style={styles.backBtn}
          disabled={inputLocked}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </AnimatedPressable>
        <View style={styles.progressBadge}>
          <Text style={styles.progressLabel}>{safeIndex + 1}</Text>
          <Text style={styles.progressDivider}>/</Text>
          <Text style={styles.progressTotal}>{TOTAL}</Text>
        </View>
        {isDeeper ? (
          <AnimatedPressable
            onPress={leaveDeeper}
            style={styles.skipBtn}
            disabled={inputLocked}
            accessibilityRole="button"
            accessibilityLabel="Skip extra questions"
          >
            <Text style={styles.skipText}>Skip</Text>
          </AnimatedPressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isDeeper && safeIndex === 0 ? (
          <View style={styles.deeperBanner}>
            <Text style={styles.deeperBannerTitle}>More accurate score & biological age</Text>
            <Text style={styles.deeperBannerBody}>
              These 10 extra questions are added to your first 10 — they don’t replace them.
              Finish this set if you want a more accurate wellness score and biological age.
            </Text>
          </View>
        ) : null}

        <View style={[styles.catPill, { backgroundColor: (cat?.color ?? Colors.primary) + '18' }]}>
          <Text style={styles.catPillIcon}>{cat?.icon}</Text>
          <Text style={[styles.catPillText, { color: cat?.color }]}>{cat?.label}</Text>
        </View>

        <Text style={styles.question}>{q.question}</Text>
        <Text style={styles.hint}>Select the option that best describes you</Text>

        <View style={styles.options}>
          {q.options.map((option) => {
            const isSelected = selectedScore === option.score;
            return (
              <AnimatedPressable
                key={option.id}
                style={[
                  styles.option,
                  isSelected && { borderColor: cat?.color ?? Colors.primary, backgroundColor: (cat?.color ?? Colors.primary) + '10' },
                ]}
                onPress={() => handleAnswer(option.score)}
                disabled={inputLocked}
              >
                <View style={styles.optionBody}>
                  <Text style={[styles.optionText, isSelected && { fontWeight: '700' }]}>{option.text}</Text>
                  {option.description ? (
                    <Text style={styles.optionDesc}>{option.description}</Text>
                  ) : null}
                </View>
                <View style={[styles.optionScore, { backgroundColor: (cat?.color ?? Colors.primary) + '18' }]}>
                  <Text style={[styles.optionScoreText, { color: cat?.color ?? Colors.primary }]}>
                    {option.score}
                  </Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  skipBtn: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  progressLabel: { fontSize: Typography.size.lg, fontWeight: '800', color: Colors.text },
  progressDivider: { fontSize: Typography.size.sm, color: Colors.textTertiary },
  progressTotal: { fontSize: Typography.size.sm, color: Colors.textSecondary, fontWeight: '600' },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing['3xl'] },
  deeperBanner: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  deeperBannerTitle: {
    fontSize: Typography.size.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  deeperBannerBody: {
    fontSize: Typography.size.sm,
    color: Colors.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  catPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  catPillIcon: { fontSize: 16 },
  catPillText: { fontSize: Typography.size.sm, fontWeight: '700' },
  question: {
    fontSize: Typography.size.xl,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  hint: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  options: { gap: Spacing.sm, marginTop: Spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  optionBody: { flex: 1, gap: 4 },
  optionText: { fontSize: Typography.size.base, color: Colors.text, lineHeight: 22 },
  optionDesc: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 18 },
  optionScore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionScoreText: { fontSize: Typography.size.sm, fontWeight: '800' },
});
