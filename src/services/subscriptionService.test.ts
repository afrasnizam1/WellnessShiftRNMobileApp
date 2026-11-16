const mockQuery = jest.fn();
const mockStored: { tier: string | null } = { tier: null };
const mockSave = jest.fn(async (tier: string) => {
  mockStored.tier = tier;
});

jest.mock('./iap', () => ({
  iapService: {
    queryActiveSubscription: () => mockQuery(),
  },
  getTierFromProductId: () => 'free',
}));
jest.mock('./subscriptionStorage', () => ({
  subscriptionStorage: {
    getTier: async () => mockStored.tier,
    save: (tier: string) => mockSave(tier),
    clear: async () => {
      mockStored.tier = null;
    },
  },
}));
jest.mock('./firebase', () => ({ userService: { updateProfile: jest.fn(async () => undefined) } }));
jest.mock('./firebaseReady', () => ({ isFirebaseReady: () => false }));
jest.mock('./contentsquareService', () => ({ contentsquareService: { setSubscriptionTier: jest.fn() } }));
jest.mock('./cloudFunctions', () => ({ cloudFunctions: { syncSubscriptionEntitlement: jest.fn() } }));

import { subscriptionService } from './subscriptionService';

describe('subscriptionService.syncForUser', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSave.mockClear();
    mockStored.tier = null;
  });

  it('downgrades a cached paid tier when the store reports nothing active', async () => {
    mockStored.tier = 'pro';
    mockQuery.mockResolvedValue({ ok: true, active: null });
    const onTier = jest.fn();
    await subscriptionService.syncForUser('user-1', onTier);
    expect(onTier).toHaveBeenLastCalledWith('free');
    expect(mockStored.tier).toBe('free');
  });

  it('keeps the cached tier when the store cannot be reached', async () => {
    mockStored.tier = 'pro';
    mockQuery.mockResolvedValue({ ok: false, active: null });
    const onTier = jest.fn();
    await subscriptionService.syncForUser('user-1', onTier);
    expect(onTier).toHaveBeenLastCalledWith('pro');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('grants the tier the store reports', async () => {
    mockQuery.mockResolvedValue({ ok: true, active: { tier: 'growth', productId: 'g.monthly' } });
    const onTier = jest.fn();
    await subscriptionService.syncForUser('user-1', onTier);
    expect(onTier).toHaveBeenLastCalledWith('growth');
  });

  it('clearCachedTier forgets the device tier (sign-out)', async () => {
    mockStored.tier = 'pro';
    await subscriptionService.clearCachedTier();
    expect(mockStored.tier).toBeNull();
  });
});
