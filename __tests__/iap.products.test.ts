jest.mock('react-native-iap', () => ({
  __esModule: true,
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  fetchProducts: jest.fn(),
  getAvailablePurchases: jest.fn(async () => []),
  finishTransaction: jest.fn(),
  requestPurchase: jest.fn(),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  ErrorCode: {},
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { ALL_PRODUCT_IDS, getTierFromProductId, resolveHighestSubscription } from '../src/services/iap';
import type { Purchase } from 'react-native-iap';

describe('IAP product map', () => {
  it('maps all known product IDs to paid tiers', () => {
    for (const id of ALL_PRODUCT_IDS) {
      expect(getTierFromProductId(id)).not.toBe('free');
    }
  });

  it('resolveHighestSubscription prefers pro over growth', () => {
    const purchases = [
      { productId: 'com.wellnessshift.growth.monthly' },
      { productId: 'com.wellnessshift.pro.yearly' },
    ] as Purchase[];
    expect(resolveHighestSubscription(purchases)?.tier).toBe('pro');
  });

  it('resolveHighestSubscription returns null when empty', () => {
    expect(resolveHighestSubscription([])).toBeNull();
  });
});
