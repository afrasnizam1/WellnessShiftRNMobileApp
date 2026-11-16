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
