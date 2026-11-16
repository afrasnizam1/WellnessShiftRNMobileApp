import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WellnessScore } from '../types';
import type { AssessmentAnswerMap } from '../utils/wellnessAssessmentScoring';
import type { AppPurpose, ExperienceLevel, ReminderAnchor } from '../types/onboardingPrefs';

const KEY = 'wellnessshift_pending_onboarding_v1';

function currentAuthUid(): string | null {
  try {
    const auth = require('@react-native-firebase/auth').default;
    return auth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/** Guest progress (no owner) or progress this account wrote itself. */
export function pendingBelongsTo(pending: { ownerUid?: string | null }, uid: string): boolean {
  return !pending.ownerUid || pending.ownerUid === uid;
}

export type AssessmentPath = 'mini' | 'full';

export interface PendingOnboardingData {
  /**
   * Account that wrote this progress while signed in. Null for guest progress.
   * Progress stamped with another account is never applied (shared devices).
   */
  ownerUid: string | null;
  breathWelcomeComplete: boolean;
  /** Guest saw the launch welcome video (IntroVideoScreen). */
  welcomeVideoComplete: boolean;
  appPurpose: AppPurpose | null;
  appPurposes: AppPurpose[];
  goals: string[];
  primaryGoal: string | null;
  experienceLevel: ExperienceLevel | null;
  trainingDaysPerWeek: number | null;
  reminderAnchor: ReminderAnchor | null;
  hasHomeEquipment: boolean | null;
  baselineStepComplete: boolean;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  assessmentPath: AssessmentPath | null;
  quizAnswers: AssessmentAnswerMap | null;
  wellnessScore: WellnessScore | null;
  quizComplete: boolean;
  /**
   * Set ONLY by saveQuiz after the user finishes answering.
   * Results screen/route are gated on this so stale scores never skip the quiz.
   */
  awaitingResultsPreview: boolean;
  resultsPreviewComplete: boolean;
  /** Guest saw the 3s “building your plan” interstitial after the quiz. */
  planBuildingComplete: boolean;
  moodLevel: string | null;
  moodStepComplete: boolean;
  notificationPromptSeen: boolean;
  healthPromptSeen: boolean;
  paywallSeen: boolean;
  firstWinComplete: boolean;
  triedFirstActivity: boolean;
}

const EMPTY: PendingOnboardingData = {
  ownerUid: null,
  breathWelcomeComplete: false,
  welcomeVideoComplete: false,
  appPurpose: null,
  appPurposes: [],
  goals: [],
  primaryGoal: null,
  experienceLevel: null,
  trainingDaysPerWeek: null,
  reminderAnchor: null,
  hasHomeEquipment: null,
  baselineStepComplete: false,
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  assessmentPath: null,
  quizAnswers: null,
  wellnessScore: null,
  quizComplete: false,
  awaitingResultsPreview: false,
  resultsPreviewComplete: false,
  planBuildingComplete: false,
  moodLevel: null,
  moodStepComplete: false,
  notificationPromptSeen: false,
  healthPromptSeen: false,
  paywallSeen: false,
  firstWinComplete: false,
  triedFirstActivity: false,
};

const QUIZ_RESET = {
  quizAnswers: null,
  wellnessScore: null,
  quizComplete: false,
  awaitingResultsPreview: false,
  resultsPreviewComplete: false,
  planBuildingComplete: false,
} as const;

export function pendingCanShowResults(pending: PendingOnboardingData): boolean {
  // Gate on explicit quiz finish + score. Don't require answer counts —
  // wiping progress when answers are briefly missing caused a double quiz.
  return pending.awaitingResultsPreview === true && !!pending.wellnessScore;
}

/** True when the user just finished the quiz and should see Results, not retake. */
export function pendingJustFinishedQuiz(pending: PendingOnboardingData): boolean {
  return (
    pending.awaitingResultsPreview === true ||
    (pending.quizComplete === true && !pending.resultsPreviewComplete && !!pending.wellnessScore)
  );
}

export const pendingOnboardingStorage = {
  get: async (): Promise<PendingOnboardingData> => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return { ...EMPTY };
      return { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      return { ...EMPTY };
    }
  },

  save: async (patch: Partial<PendingOnboardingData>): Promise<PendingOnboardingData> => {
    const current = await pendingOnboardingStorage.get();
    const signedInUid = currentAuthUid();
    // A different account's leftovers never carry into this one.
    const base = signedInUid && current.ownerUid && current.ownerUid !== signedInUid ? { ...EMPTY } : current;
    const next = { ...base, ...patch, ownerUid: signedInUid ?? base.ownerUid ?? null };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  },

  clearQuizProgress: async () => pendingOnboardingStorage.save({ ...QUIZ_RESET }),

  markBreathWelcomeComplete: async () =>
    pendingOnboardingStorage.save({ breathWelcomeComplete: true }),

  markWelcomeVideoComplete: async () =>
    pendingOnboardingStorage.save({
      welcomeVideoComplete: true,
      // Keep legacy breath flag in sync so older gates don't re-open breath welcome.
      breathWelcomeComplete: true,
    }),

  savePurpose: async (appPurpose: AppPurpose, appPurposes?: AppPurpose[]) =>
    pendingOnboardingStorage.save({
      appPurpose,
      appPurposes: appPurposes?.length ? appPurposes : [appPurpose],
    }),

  saveGoals: async (goals: string[], primaryGoal: string) =>
    pendingOnboardingStorage.save({ goals, primaryGoal }),

  /** Choosing a path starts a fresh assessment — wipe any leftover score/answers. */
  saveAssessmentPath: async (assessmentPath: AssessmentPath) =>
    pendingOnboardingStorage.save({
      assessmentPath,
      ...QUIZ_RESET,
    }),

  saveQuiz: async (wellnessScore: WellnessScore, quizAnswers: AssessmentAnswerMap) =>
    pendingOnboardingStorage.save({
      wellnessScore,
      quizAnswers,
      quizComplete: true,
      awaitingResultsPreview: true,
      resultsPreviewComplete: false,
      planBuildingComplete: false,
    }),

  markPlanBuildingComplete: async () =>
    pendingOnboardingStorage.save({ planBuildingComplete: true }),

  markResultsPreviewComplete: async () =>
    pendingOnboardingStorage.save({
      resultsPreviewComplete: true,
      awaitingResultsPreview: false,
    }),

  saveMood: async (moodLevel: string) =>
    pendingOnboardingStorage.save({ moodLevel }),

  clear: async () => AsyncStorage.removeItem(KEY),

  hasPendingPlan: async (): Promise<boolean> => {
    const data = await pendingOnboardingStorage.get();
    return data.resultsPreviewComplete && !!data.wellnessScore;
  },
};
