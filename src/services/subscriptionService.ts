import { Alert, Linking, Platform } from 'react-native';
import { appConfig } from '../config/appConfig';
import {
  iapService,
  getProductId,
  isPurchaseCancelled,
  type ActiveSubscription,
} from './iap';
import { subscriptionStorage } from './subscriptionStorage';
import { userService } from './firebase';
import { isFirebaseReady } from './firebaseReady';
import { contentsquareService } from './contentsquareService';
import type { SubscriptionTier } from '../types';
import { logger } from '../utils/logger';

type TierListener = (tier: SubscriptionTier) => void;

let cleanupListeners: (() => void) | null = null;
let currentUid: string | null = null;

async function persistTier(
  tier: SubscriptionTier,
  productId?: string,
  uid?: string | null,
  transactionId?: string,
) {
  await subscriptionStorage.save(tier, productId);
  const resolvedUid = uid ?? currentUid;
  if (resolvedUid && isFirebaseReady()) {
    await userService.updateProfile(resolvedUid, {
      subscriptionTier: tier,
    }).catch(() => {});

    try {
      const { cloudFunctions } = await import('./cloudFunctions');
      if (tier === 'free') {
        await cloudFunctions.syncSubscriptionEntitlement({ clear: true });
      } else if (productId) {
        await cloudFunctions.syncSubscriptionEntitlement({
          productId,
          transactionId,
        });
      }
    } catch (error) {
      console.warn('[subscriptionService] entitlement sync failed:', error);
    }
  }
}

export const subscriptionService = {
  init: async (onTierChange: TierListener) => {
    if (appConfig.enableDevSubscriptionBypass) {
      onTierChange(appConfig.devSubscriptionTier);
      return () => {};
    }

    try {
      const connected = await iapService.init();
      if (!connected) {
        return () => {};
      }
      await iapService.loadStoreProducts();

      const storedTier = await subscriptionStorage.getTier();
      if (storedTier) {
        onTierChange(storedTier);
      }

      const { ok, active } = await iapService.queryActiveSubscription();
      if (active) {
        await persistTier(active.tier, active.productId);
        onTierChange(active.tier);
      } else if (ok && storedTier && storedTier !== 'free') {
        // Store answered and nothing is active: the subscription lapsed.
        await persistTier('free');
        onTierChange('free');
      }

      cleanupListeners?.();
      cleanupListeners = iapService.setupListeners(
        async (purchase, tier) => {
          await persistTier(tier, purchase.productId, undefined, purchase.id);
          onTierChange(tier);

          const product = iapService.getCachedStoreProducts().find(
            (item) => iapService.productSku(item) === purchase.productId
          );
          const price = product ? parseFloat(iapService.productPriceAmount(product)) : 0;
          if (price > 0) {
            contentsquareService.trackSubscriptionPurchase(
              purchase.productId,
              price,
              purchase.id
            );
          }
        },
        (error) => {
          if (!isPurchaseCancelled(error)) {
            logger.log('[IAP] purchase error:', error.message ?? error.code);
            // Store errors arrive here, not from purchase(): tell the person, don't fail silently.
            Alert.alert(
              'Purchase not completed',
              'The App Store could not complete this purchase. You have not been charged. Please try again, or restore an existing purchase.',
            );
          }
        }
      );

      return () => {
        cleanupListeners?.();
        cleanupListeners = null;
      };
    } catch (e) {
      logger.log('[subscriptionService] Billing init skipped:', e);
      return () => {};
    }
  },

  setCurrentUser: (uid: string | null) => {
    currentUid = uid;
  },

  syncForUser: async (uid: string, onTierChange: TierListener) => {
    currentUid = uid;
    if (appConfig.enableDevSubscriptionBypass) {
      onTierChange(appConfig.devSubscriptionTier);
      return;
    }

    const { ok, active } = await iapService.queryActiveSubscription();
    if (active) {
      await persistTier(active.tier, active.productId, uid);
      onTierChange(active.tier);
      return;
    }

    const stored = await subscriptionStorage.getTier();
    if (ok) {
      // Store answered: nothing active means free, whatever this device cached.
      if (stored && stored !== 'free') await persistTier('free', undefined, uid);
      onTierChange('free');
      return;
    }
    // Store unreachable (offline): keep the cached tier until it can be checked.
    if (stored) {
      onTierChange(stored);
    }
  },

  /** Forget this device's cached tier (sign-out), so the next account starts clean. */
  clearCachedTier: () => subscriptionStorage.clear(),

  loadStoreProducts: () => iapService.loadStoreProducts(),

  getLocalizedPrice: (tier: 'growth' | 'pro', period: 'monthly' | 'yearly') => {
    const productId = getProductId(tier, period);
    const fallback = tier === 'pro'
      ? period === 'yearly' ? '£79.99' : '£8.99'
      : period === 'yearly' ? '£59.99' : '£6.99';
    return iapService.getLocalizedPrice(productId, fallback);
  },

  purchase: async (tier: 'growth' | 'pro', period: 'monthly' | 'yearly') => {
    if (appConfig.enableDevSubscriptionBypass) {
      await persistTier(appConfig.devSubscriptionTier);
      return { tier: appConfig.devSubscriptionTier };
    }
    const productId = getProductId(tier, period);
    await iapService.subscribe(productId);
    return null;
  },

  restore: async (): Promise<ActiveSubscription | null> => {
    if (appConfig.enableDevSubscriptionBypass) {
      await persistTier(appConfig.devSubscriptionTier);
      return { tier: appConfig.devSubscriptionTier, productId: 'dev_bypass' };
    }
    const active = await iapService.restore();
    if (active) {
      await persistTier(active.tier, active.productId);
    } else {
      await persistTier('free');
    }
    return active;
  },

  openManageSubscriptions: () => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/account/subscriptions',
      android: 'https://play.google.com/store/account/subscriptions',
    });
    if (url) Linking.openURL(url);
  },

  billingLegalText: iapService.billingLegalText,
};
