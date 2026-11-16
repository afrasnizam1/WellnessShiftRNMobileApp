const mockPending: Record<string, any> = {};
const mockClear = jest.fn(async () => {
  Object.keys(mockPending).forEach((k) => delete mockPending[k]);
});
const mockUpdateProfile = jest.fn(async (_uid: string, _data: Record<string, unknown>) => undefined);
const mockSaveScore = jest.fn(async () => undefined);

jest.mock('./pendingOnboardingStorage', () => ({
  pendingOnboardingStorage: {
    get: async () => ({ healthGoals: [], appPurposes: [], goals: [], ...mockPending }),
    clear: () => mockClear(),
  },
  pendingBelongsTo: (p: { ownerUid?: string | null }, uid: string) => !p.ownerUid || p.ownerUid === uid,
}));
jest.mock('./firebase', () => ({
  userService: { updateProfile: (uid: string, data: Record<string, unknown>) => mockUpdateProfile(uid, data) },
  wellnessService: { saveScore: () => mockSaveScore() },
}));
jest.mock('./checkInService', () => ({
  checkInService: new Proxy({}, { get: () => jest.fn(async () => undefined) }),
}));
jest.mock('./onboardingStorage', () => ({
  onboardingStorage: new Proxy({}, { get: () => jest.fn(async () => undefined) }),
}));

import { applyPendingOnboardingToAccount } from './applyPendingOnboarding';

const score = { overall: 7, categories: {}, date: '2026-11-16T10:00:00Z' };

describe('applyPendingOnboardingToAccount', () => {
  beforeEach(() => {
    mockClear();
    mockClear.mockClear();
    mockUpdateProfile.mockClear();
    mockSaveScore.mockClear();
  });

  it("never copies another account's quiz into this account", async () => {
    Object.assign(mockPending, {
      ownerUid: 'user-a',
      quizComplete: true,
      wellnessScore: score,
      quizAnswers: { q1: 3 },
      dateOfBirth: '1990-01-01',
    });
    const applied = await applyPendingOnboardingToAccount('user-b');
    expect(applied).toBe(false);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockSaveScore).not.toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
  });

  it('never moves an account back into onboarding', async () => {
    Object.assign(mockPending, { ownerUid: null, appPurpose: 'self' });
    await applyPendingOnboardingToAccount('user-b');
    const writes = mockUpdateProfile.mock.calls.map((c: unknown[]) => c[1] as Record<string, unknown>);
    for (const w of writes) expect(w.onboardingComplete).not.toBe(false);
  });
});
