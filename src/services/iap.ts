// src/services/iap.ts
// react-native-iap v15+ (OpenIAP) — product IDs must match App Store Connect / Google Play Console

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  isUserCancelledError,
  type ProductSubscription,
  type Purchase,
} from 'react-native-iap';
import type { SubscriptionTier } from '../types';
import { appConfig } from '../config/appConfig';
import { logger } from '../utils/logger';
import { useAppStore } from '../store';

export const PRODUCT_IDS = {
  growthMonthly: 'com.wellnessshift.growth.monthly',
  growthYearly: 'com.wellnessshift.growth.yearly',
  proMonthly: 'com.wellnessshift.pro.monthly',
  proYearly: 'com.wellnessshift.pro.yearly',
} as const;

export const ALL_PRODUCT_IDS = Object.values(PRODUCT_IDS);

/** Thrown by subscribe() when the store has not returned the plan (products not set up, offline). */
export const STORE_UNAVAILABLE = 'store-unavailable';

/** True when the person closed the store sheet. Covers v15 ('user-cancelled') and older codes. */
export function isPurchaseCancelled(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return isUserCancelledError(error) || code === 'E_USER_CANCELLED';
}

export const SUBSCRIPTION_PRODUCTS = [
  {
    productId: PRODUCT_IDS.growthMonthly,
    tier: 'growth' as SubscriptionTier,
    period: 'monthly' as const,
    /** Fallback only — UI must prefer store-localized price via getLocalizedPrice() */
    price: '£6.99',
    title: 'Growth Monthly',
  },
  {
    productId: PRODUCT_IDS.growthYearly,
    tier: 'growth' as SubscriptionTier,
    period: 'yearly' as const,
    price: '£59.99',
    title: 'Growth Yearly',
  },
  {
    productId: PRODUCT_IDS.proMonthly,
    tier: 'pro' as SubscriptionTier,
    period: 'monthly' as const,
    price: '£8.99',
    title: 'Pro Monthly',
  },
  {
    productId: PRODUCT_IDS.proYearly,
    tier: 'pro' as SubscriptionTier,
    period: 'yearly' as const,
    price: '£79.99',
    title: 'Pro Yearly',
  },
];

export interface ActiveSubscription {
  tier: SubscriptionTier;
  productId: string;
}

function tierRank(tier: SubscriptionTier): number {
  if (tier === 'pro') return 2;
  if (tier === 'growth') return 1;
  return 0;
}

export function getTierFromProductId(productId: string): SubscriptionTier {
  if (productId === PRODUCT_IDS.proMonthly || productId === PRODUCT_IDS.proYearly) {
    return 'pro';
  }
  if (productId === PRODUCT_IDS.growthMonthly || productId === PRODUCT_IDS.growthYearly) {
    return 'growth';
  }
  return 'free';
}

export function getProductId(tier: 'growth' | 'pro', period: 'monthly' | 'yearly'): string {
  if (tier === 'pro') {
    return period === 'yearly' ? PRODUCT_IDS.proYearly : PRODUCT_IDS.proMonthly;
  }
  return period === 'yearly' ? PRODUCT_IDS.growthYearly : PRODUCT_IDS.growthMonthly;
}

function productSku(product: ProductSubscription): string {
  return product.id;
}

function productPriceLabel(product: ProductSubscription): string {
  return product.displayPrice || (product as { localizedPrice?: string | null }).localizedPrice || '';
}

function productPriceAmount(product: ProductSubscription): string {
  if ('price' in product && typeof (product as { price?: number }).price === 'number') {
    return String((product as { price: number }).price);
  }
  const label = productPriceLabel(product).replace(/[^0-9.,]/g, '').replace(',', '.');
  return label || '0';
}

export function resolveHighestSubscription(purchases: Purchase[]): ActiveSubscription | null {
  let best: ActiveSubscription | null = null;

  for (const purchase of purchases) {
    const productId = purchase.productId;
    if (!productId) continue;
    const tier = getTierFromProductId(productId);
    if (tier === 'free') continue;

    if (!best || tierRank(tier) > tierRank(best.tier)) {
      best = { tier, productId };
    }
  }

  return best;
}

function androidOffersForSku(productId: string): { sku: string; offerToken: string }[] {
  const product = storeProducts.find((p) => productSku(p) === productId);
  if (!product || product.platform !== 'android') return [];
  const details = product.subscriptionOfferDetailsAndroid ?? [];
  return details
    .filter((offer) => !!offer.offerToken)
    .map((offer) => ({ sku: productId, offerToken: offer.offerToken }));
}

let storeProducts: ProductSubscription[] = [];

export const iapService = {
  /**
   * Connect to the store. Returns false when billing is unavailable
   * (Android emulator, or Play Billing not set up). That case is expected
   * and must not raise a LogBox error.
   */
  init: async (): Promise<boolean> => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const text = args
        .map((arg) => {
          if (arg instanceof Error) return arg.message;
          if (typeof arg === 'string') return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');
      if (text.includes('Failed to initialize IAP connection')) return;
      originalError(...args);
    };
    try {
      await initConnection();
      return true;
    } catch {
      logger.log(
        '[IAP] Billing is not available in this build. Subscription screens keep the fallback prices.',
      );
      return false;
    } finally {
      console.error = originalError;
    }
  },

  end: async () => {
    try {
      await endConnection();
    } catch {}
  },

  loadStoreProducts: async (): Promise<ProductSubscription[]> => {
    try {
      const products = await fetchProducts({ skus: [...ALL_PRODUCT_IDS], type: 'subs' });
      storeProducts = (products ?? []) as ProductSubscription[];
      if (__DEV__) {
        const found = new Set(storeProducts.map(productSku));
        const missing = ALL_PRODUCT_IDS.filter((id) => !found.has(id));
        if (missing.length > 0) {
          logger.log(
            '[IAP] Store did not return these product IDs yet:',
            missing.join(', '),
          );
        } else {
          logger.log('[IAP] All subscription product IDs resolved from the store.');
        }
      }
      return storeProducts;
    } catch (e) {
      storeProducts = [];
      if (__DEV__) {
        logger.log('[IAP] Could not load store products. Using fallback prices.', e);
      }
      return [];
    }
  },

  getCachedStoreProducts: () => storeProducts,

  getLocalizedPrice: (productId: string, fallback: string): string => {
    const product = storeProducts.find((p) => productSku(p) === productId);
    return product ? productPriceLabel(product) || fallback : fallback;
  },

  subscribe: async (productId: string) => {
    // Without the product from the store, requestPurchase fails silently on iOS —
    // the button would appear to do nothing. Reload once, then fail loudly.
    const hasProduct = () => storeProducts.some((p) => productSku(p) === productId);
    if (!hasProduct()) await iapService.loadStoreProducts();
    if (!hasProduct()) {
      throw Object.assign(new Error('This plan is not available from the store right now.'), {
        code: STORE_UNAVAILABLE,
      });
    }
    if (Platform.OS === 'android') {
      const subscriptionOffers = androidOffersForSku(productId);
      if (subscriptionOffers.length === 0) {
        throw new Error('No Google Play subscription offer available for this plan.');
      }
      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [productId],
            subscriptionOffers,
          },
        },
      });
      return;
    }

    await requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: productId },
      },
    });
  },

  syncActiveSubscription: async (): Promise<ActiveSubscription | null> =>
    (await iapService.queryActiveSubscription()).active,

  /**
   * `ok: false` means the store could not be asked (offline, billing unavailable),
   * so a cached tier may still be used. `ok: true` with `active: null` means the
   * store answered and nothing is active — the subscription lapsed or never existed.
   */
  queryActiveSubscription: async (): Promise<{ ok: boolean; active: ActiveSubscription | null }> => {
    try {
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      return { ok: true, active: resolveHighestSubscription(purchases) };
    } catch {
      return { ok: false, active: null };
    }
  },

  restore: async (): Promise<ActiveSubscription | null> => {
    const purchases = await getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    });
    return resolveHighestSubscription(purchases);
  },

  setupListeners: (
    onPurchase: (purchase: Purchase, tier: SubscriptionTier) => void,
    onError: (error: { code?: string; message?: string }) => void
  ) => {
    const successSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        const tier = getTierFromProductId(purchase.productId);
        await finishTransaction({ purchase, isConsumable: false });
        onPurchase(purchase, tier);
      } catch (e) {
        onError({ message: e instanceof Error ? e.message : 'Purchase processing failed' });
      }
    });

    const errorSub = purchaseErrorListener((error) => {
      onError({ code: error.code, message: error.message });
    });

    return () => {
      successSub.remove();
      errorSub.remove();
    };
  },

  getTierFromProductId,
  getProductId,
  productSku,
  productPriceAmount,

  billingLegalText: Platform.select({
    ios: 'Subscriptions renew automatically. Cancel anytime in Settings → Apple ID → Subscriptions. Payment charged to your Apple ID.',
    android: 'Subscriptions renew automatically. Cancel anytime in Google Play → Payments & subscriptions.',
    default: 'Subscriptions renew automatically. Cancel anytime in your app store settings.',
  }) ?? '',
};

export const PREMIUM_FEATURES: Record<string, SubscriptionTier[]> = {
  aiChat: ['growth', 'pro'],
  advancedAnalytics: ['growth', 'pro'],
  customWorkouts: ['pro'],
  mealPlanning: ['growth', 'pro'],
  brainGamesUnlimited: ['growth', 'pro'],
  meditationUnlimited: ['growth', 'pro'],
  calculatorsFull: ['growth', 'pro'],
  clinicianIntegration: ['pro'],
  wellnessExport: ['growth', 'pro'],
};

export function getEffectiveTier(storeTier: SubscriptionTier): SubscriptionTier {
  if (appConfig.enableDevSubscriptionBypass) {
    return appConfig.devSubscriptionTier;
  }
  // Active complimentary preview unlocks Pro features.
  if (appConfig.enableComplimentaryPreview && storeTier === 'free' && useAppStore.getState().trialActive) {
    return 'pro';
  }
  return storeTier;
}

export const canAccessFeature = (
  feature: string,
  tier: SubscriptionTier
): boolean => {
  const effectiveTier = getEffectiveTier(tier);
  const required = PREMIUM_FEATURES[feature];
  if (!required) return true;
  return required.includes(effectiveTier);
};

/** True when the user has Growth/Pro (or an active complimentary preview). */
export function hasPremiumAccess(tier: SubscriptionTier): boolean {
  return getEffectiveTier(tier) !== 'free';
};
