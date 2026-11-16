import { CSQ, Currency, StartConfig } from '@contentsquare/react-native-bridge';
import type { AnalyticsOptions } from '@contentsquare/react-native-bridge';
import { Linking, Platform, Settings } from 'react-native';
import { appConfig } from '../config/appConfig';
import { contentsquareConfig, hasContentsquareStartId } from '../config/contentsquareConfig';
import type { UserProfile } from '../types';
import { contentsquareStorage } from './contentsquareStorage';
import { analyticsHelper } from './analyticsHelper';
import { logger } from '../utils/logger';

type CsqGlobal = typeof globalThis & { __csqStarted?: boolean };

let started = false;
let analyticsActive = false;
let initPromise: Promise<void> | null = null;
let metadataUnsubscribe: (() => void) | null | undefined = null;
let replayLinkUnsubscribe: (() => void) | null | undefined = null;
let linkingUnsubscribe: (() => void) | null = null;
let lastScreenview: string | null = null;
/** Queued while opt-in is still resolving — CSQ discards replay without a screenview. */
let pendingScreenview: string | null = null;
let replayRetryTimer: ReturnType<typeof setTimeout> | null = null;

function sdkAlreadyStarted(): boolean {
  return started || !!(global as CsqGlobal).__csqStarted;
}

function markSdkStarted(): void {
  started = true;
  (global as CsqGlobal).__csqStarted = true;
}

function canUseContentsquare(): boolean {
  return appConfig.enableContentsquare && hasContentsquareStartId();
}

function currentScreenName(): string | null {
  return pendingScreenview ?? lastScreenview;
}

/**
 * Contentsquare drops the replay unless a screenview is sent after the recorder starts.
 * Navigation dedupes the same route, so this resend has to come from here.
 */
function publishScreenview(screenview: string): void {
  lastScreenview = screenview;
  pendingScreenview = screenview;
  CSQ.trackScreenview(screenview);
  if (__DEV__) {
    logger.log(`[CSQ] screenview: ${screenview}`);
  }
}

/**
 * Start the recorder. `sessionReplayAutoStart` is false at SDK start so this is the
 * only path that records. Do not call stopSessionReplay — that is terminal for the
 * process, and an unmatched triggerReplay name does not upload a replay.
 */
function ensureSessionReplayRunning(reason: string): void {
  if (!appConfig.contentsquareSessionReplayAutoStart || !analyticsActive) return;

  try {
    CSQ.startSessionReplay();
    logger.log(`[CSQ] session replay started (${reason}) on ${Platform.OS}`);
  } catch (e) {
    console.warn(`[CSQ] startSessionReplay failed (${reason}):`, e);
  }

  const screen = currentScreenName();
  if (!screen) return;
  lastScreenview = null;
  publishScreenview(screen);
}

function scheduleSessionReplay(reason: string): void {
  if (replayRetryTimer) {
    clearTimeout(replayRetryTimer);
    replayRetryTimer = null;
  }
  ensureSessionReplayRunning(reason);
  // Android posts start/optIn onto the UI thread. A call that lands before CSQ.start
  // finishes is ignored, so retry once after the native start has settled.
  replayRetryTimer = setTimeout(() => {
    replayRetryTimer = null;
    ensureSessionReplayRunning(`${reason}_retry`);
  }, Platform.OS === 'android' ? 800 : 400);
}

function cancelScheduledReplay(): void {
  if (!replayRetryTimer) return;
  clearTimeout(replayRetryTimer);
  replayRetryTimer = null;
}

/**
 * Opt-in analytics for App Store / health privacy.
 * No explicit preference → do not collect. Profile toggle opts in or out.
 */
async function shouldCollectAnalytics(_user?: UserProfile | null): Promise<boolean> {
  if (await contentsquareStorage.hasExplicitPreference()) {
    return contentsquareStorage.isEnabled();
  }
  return false;
}

function csqIdentity(user: UserProfile | null | undefined): string {
  // Prefer opaque UID — never send raw email as CSQ identity for health apps.
  const uid = user?.uid?.trim();
  if (uid) return uid;
  return user?.csq?.identity ?? 'unknown';
}

async function activateAnalytics(user?: UserProfile | null, userInitiated = false): Promise<void> {
  if (!canUseContentsquare()) return;

  analyticsActive = true;
  if (userInitiated) {
    await contentsquareStorage.setUserPreference(true);
  } else {
    await contentsquareStorage.setEnabled(true);
  }

  CSQ.optIn();
  try {
    CSQ.setDefaultMasking(appConfig.contentsquareDefaultMasking);
  } catch (e) {
    console.warn('[CSQ] setDefaultMasking failed:', e);
  }

  // Auto-start is off so opt-out users never record. After optIn, start the recorder
  // and send the current screen — CSQ will not upload a replay without that screenview.
  scheduleSessionReplay('opt_in');

  if (user) {
    contentsquareService.identifyUser(user);
  }

  logger.log(`[CSQ] analytics active on ${Platform.OS} — autocapture + session replay on`);
}

async function deactivateAnalytics(userInitiated = false): Promise<void> {
  if (!canUseContentsquare()) return;

  analyticsActive = false;
  cancelScheduledReplay();
  if (userInitiated) {
    await contentsquareStorage.setUserPreference(false);
  }

  contentsquareService.clearUserIdentity();
  // optOut stops collection. stopSessionReplay cannot be started again in this process,
  // so a later Profile opt-in would never upload a replay until the app was killed.
  CSQ.optOut();
}

function analyticsOptions(autoStartReplay: boolean): AnalyticsOptions {
  return {
    // Touches/interactions only — screenviews come from React Navigation → trackNavigationScreenview.
    enableRNAutocapture: true,
    enableViewAutocapture: false,
    disablePageviewAutocapture: true,
    disablePageviewTitleAutocapture: true,
    // Product Analytics: notification tap / interaction events (FCM + local).
    // https://docs.contentsquare.com/en/csq-sdk-react-native/product-analytics/track-push-notifications/
    enablePushNotificationAutocapture: true,
    enablePushNotificationTitleAutocapture: true,
    enablePushNotificationBodyAutocapture: true,
    // Only arm the native recorder when this launch already has an explicit opt-in.
    // Otherwise startSessionReplay after Profile opt-in is the start path.
    sessionReplayAutoStart: autoStartReplay,
  };
}

function buildStartConfig(autoStartReplay: boolean) {
  const options = analyticsOptions(autoStartReplay);
  if (contentsquareConfig.dataSourceId) {
    return StartConfig.withDataSourceId(contentsquareConfig.dataSourceId, options);
  }
  return StartConfig.withEnvironmentId(contentsquareConfig.environmentId!, options);
}

function attachDebugLogging(): void {
  CSQ.logToConsole();
  const idLabel = contentsquareConfig.dataSourceId
    ? `dataSource:${contentsquareConfig.dataSourceId}`
    : `project:${contentsquareConfig.environmentId}`;
  logger.log(
    '[CSQ]',
    idLabel,
    Platform.OS === 'ios' ? `bundle: ${appConfig.iosBundleId}` : `bundle: ${appConfig.androidApplicationId}`,
  );

  metadataUnsubscribe = CSQ.onMetadataChange((metadata) => {
    logger.log(
      '[CSQ] session:',
      metadata.sessionID,
      'project:',
      metadata.projectID,
      'identity:',
      metadata.identity,
      'replay:',
      metadata.sessionReplayURL
    );
  });
  replayLinkUnsubscribe = CSQ.onSessionReplayLinkChange((link) => {
    logger.log('[CSQ] replay link:', link);
  });
}

/**
 * Snapshot Capture / in-app features: QR deeplinks use scheme
 * `cs-$(PRODUCT_BUNDLE_IDENTIFIER)` (e.g. cs-afras.wellnessshiftrn.ios / cs-afras.wellnessshiftrn.android).
 * Must run AFTER CSQ.start(). iOS AppDelegate stashes the URL —
 * calling handle before start (or twice) freezes the UI.
 * Android merges the cs-… intent filter from the CSQ SDK; JS still forwards via Linking.
 * @see https://docs.contentsquare.com/en/react-native/in-app-features/
 */
function attachInAppFeatureUrlHandling(): void {
  if (linkingUnsubscribe) return;

  let lastHandled: string | null = null;
  let handleTimer: ReturnType<typeof setTimeout> | null = null;

  const isCsqActivationUrl = (url: string) =>
    /^cs-/i.test(url) || url.toLowerCase().includes('contentsquare');

  const forward = (url: string | null | undefined) => {
    if (!url || !isCsqActivationUrl(url) || lastHandled === url) return;
    lastHandled = url;

    // Defer off the openURL / Linking callback stack so the SDK UI doesn't deadlock.
    if (handleTimer) clearTimeout(handleTimer);
    handleTimer = setTimeout(() => {
      try {
        CSQ.optIn();
        analyticsActive = true;
        CSQ.handleUrl(url);
        scheduleSessionReplay('in_app_features');
        if (__DEV__) {
          logger.log('[CSQ] handleUrl:', url);
        }
      } catch (e) {
        console.warn('[CSQ] handleUrl failed:', e);
        lastHandled = null;
      }
    }, 250);
  };

  // Cold start (iOS): URL stashed by AppDelegate before JS was ready.
  if (Platform.OS === 'ios') {
    try {
      const pending = Settings.get('CSQPendingActivationURL');
      if (typeof pending === 'string' && pending.length > 0) {
        Settings.set({ CSQPendingActivationURL: null });
        forward(pending);
      }
    } catch {
      /* Settings unavailable */
    }
  }

  Linking.getInitialURL()
    .then(forward)
    .catch((e) => console.warn('[CSQ] getInitialURL failed:', e));

  const sub = Linking.addEventListener('url', ({ url }) => forward(url));
  linkingUnsubscribe = () => {
    if (handleTimer) clearTimeout(handleTimer);
    sub.remove();
  };
}

export const contentsquareService = {
  init: () => {
    if (!initPromise) {
      initPromise = (async () => {
        if (!canUseContentsquare()) {
          started = true;
          return;
        }

        if (!sdkAlreadyStarted()) {
          // Read Profile consent before start. Opting out first, then starting replay,
          // leaves the native SDK opted out for this process and the replay is never uploaded.
          const collect = await shouldCollectAnalytics();
          // Keep auto-start off. startSessionReplay() is ignored unless auto-start was
          // disabled, and it is a no-op while the SDK is still opted out.
          CSQ.start(buildStartConfig(false));
          CSQ.setDefaultMasking(appConfig.contentsquareDefaultMasking);
          attachDebugLogging();
          markSdkStarted();

          if (!collect) {
            analyticsActive = false;
            try {
              CSQ.optOut();
            } catch {
              /* SDK may not be ready for optOut before start completes */
            }
          } else {
            await activateAnalytics();
          }
        }

        // Snapshot Capture QR deeplinks must reach CSQ.handleUrl after start.
        attachInAppFeatureUrlHandling();
      })();
    }
    return initPromise;
  },

  isAnalyticsEnabled: async () => analyticsActive || (await shouldCollectAnalytics()),

  identifyUser: (user: UserProfile) => {
    if (!canUseContentsquare()) return;

    const identity = csqIdentity(user);
    CSQ.identify(identity);
    CSQ.sendUserIdentifier(identity);
    CSQ.addUserProperties({
      role: user.role,
      identity,
    });
  },

  clearUserIdentity: () => {
    if (!canUseContentsquare()) return;
    CSQ.resetIdentity();
  },

  setAnalyticsEnabled: async (enabled: boolean, user?: UserProfile | null, userInitiated = false) => {
    await contentsquareService.init();
    if (!canUseContentsquare()) return;

    if (enabled) {
      await activateAnalytics(user, userInitiated);
    } else {
      await deactivateAnalytics(userInitiated);
    }
  },

  restoreConsentAndOptIn: async (user: UserProfile) => {
    if (!canUseContentsquare()) return;

    if (await shouldCollectAnalytics(user)) {
      await activateAnalytics(user);
    }
  },

  syncAnalyticsForUser: async (user: UserProfile | null, authLoading = false) => {
    if (!canUseContentsquare()) return;
    if (authLoading) return;
    await contentsquareService.init();

    // Explicit Profile opt-out wins over everything else.
    if (!(await shouldCollectAnalytics(user))) {
      if (analyticsActive) await deactivateAnalytics();
      return;
    }

    if (!user) {
      // Signed out: drop identity; do not force collection without consent.
      if (analyticsActive) contentsquareService.clearUserIdentity();
      return;
    }

    await contentsquareService.restoreConsentAndOptIn(user);
  },

  onAuthSuccess: async (user: UserProfile) => {
    await contentsquareService.init();
    if (!canUseContentsquare()) return;

    if (await shouldCollectAnalytics(user)) {
      await activateAnalytics(user);
    } else if (analyticsActive) {
      contentsquareService.identifyUser(user);
    }
  },

  trackNavigationScreenview: (screenview: string | null) => {
    if (!canUseContentsquare() || !screenview) return;

    if (!analyticsActive) {
      // Hold until optIn completes — without a screenview, CSQ discards the replay.
      pendingScreenview = screenview;
      if (__DEV__) {
        logger.log(`[CSQ] screenview queued (waiting for opt-in): ${screenview}`);
      }
      return;
    }

    // Absolute dedupe: only fire when the screen label actually changes.
    // React Navigation emits many onStateChange events for the same leaf route
    // (focus, nested stack updates, tab blur). A time window still double-counted.
    if (lastScreenview === screenview) return;
    publishScreenview(screenview);
  },

  trackSubscriptionPurchase: (
    productId: string,
    price: number,
    transactionId?: string | null
  ) => {
    if (!canUseContentsquare() || !analyticsActive) return;

    CSQ.trackTransaction(price, Currency.GBP, transactionId ?? productId);
    analyticsHelper.logFunnelSubscription(
      productId.includes('pro') ? 'pro' : 'growth',
      productId
    );
    CSQ.trackEvent('subscription_purchase', {
      product_id: productId,
      currency: 'GBP',
      price,
    });
  },
};
