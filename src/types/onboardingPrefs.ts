export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type ReminderAnchor = 'morning' | 'afternoon' | 'evening';

/** High-level reason for using the app — set before goal selection. */
export type AppPurpose =
  | 'wellness_score'
  | 'learn'
  | 'fitness'
  | 'clinician'
  | 'all';

/**
 * Shown on first launch and wherever someone connects with a professional.
 * Linking uses the professional's invite code.
 */
export const CLINICIAN_CONNECT_ELIGIBILITY =
  'You can connect with a professional on Wellness Shift. Doctors, clinicians, neurosurgeons, physiotherapists, physical therapists, and other registered practitioners can share a care plan and message you. Ask them for their invite code, then enter it in My Care. This is support and education, not a diagnosis. It is not a directory and not a drop-in booking service.';

export const CLINICIAN_CONNECT_SHORT =
  'Doctor, physio, or therapist. Use their invite code in My Care';

/** Professions a professional account can register as. */
export const PROFESSIONAL_SPECIALTIES = [
  'General Practice',
  'Neurosurgery',
  'Physiotherapy',
  'Physical Therapy',
  'Cardiology',
  'Dermatology',
  'Psychiatry',
  'Nutrition',
  'Sports Medicine',
  'Occupational Therapy',
  'Other',
] as const;

export const APP_PURPOSE_OPTIONS: {
  id: AppPurpose;
  title: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    id: 'wellness_score',
    title: 'Track and improve my wellness score',
    subtitle: 'One score that rises as sleep, mood, fitness, and nutrition improve',
    icon: 'analytics-outline',
  },
  {
    id: 'learn',
    title: 'Learn about health, food, and fitness',
    subtitle: 'Guides, anatomy, nutrition, and practical education',
    icon: 'book-outline',
  },
  {
    id: 'fitness',
    title: 'Build a workout or fitness routine',
    subtitle: 'Training plans, habits, and movement that stick',
    icon: 'barbell-outline',
  },
  {
    id: 'clinician',
    title: 'Connect with a professional',
    subtitle: CLINICIAN_CONNECT_SHORT,
    icon: 'medkit-outline',
  },
  {
    id: 'all',
    title: 'All of the above',
    subtitle: 'Score, learning, fitness, and a link to your doctor or therapist',
    icon: 'apps-outline',
  },
];

export const REMINDER_ANCHOR_HOURS: Record<ReminderAnchor, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 0 },
  afternoon: { hour: 13, minute: 0 },
  evening: { hour: 18, minute: 0 },
};

export interface OnboardingPreferences {
  experienceLevel?: ExperienceLevel;
  trainingDaysPerWeek?: number;
  reminderAnchor?: ReminderAnchor;
  hasHomeEquipment?: boolean;
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  appPurpose?: AppPurpose;
  appPurposes?: AppPurpose[];
}

/** Pick the Home lead purpose from a multi-select. */
export function resolveLeadPurpose(purposes: AppPurpose[]): AppPurpose | null {
  if (purposes.length === 0) return null;
  if (purposes.includes('all') || purposes.length >= 3) return 'all';
  if (purposes.includes('clinician')) return 'clinician';
  return purposes[0];
}
