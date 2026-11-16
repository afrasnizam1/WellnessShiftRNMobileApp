import analytics from '@react-native-firebase/analytics';
import { appConfig } from '../config/appConfig';
import { logger } from '../utils/logger';

type EventParams = Record<string, string | number | boolean | null | undefined>;

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
}

function sanitizeParams(params?: EventParams): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [rawKey, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const key = sanitizeName(rawKey);
    if (!key) continue;
    if (typeof value === 'boolean') out[key] = value ? 1 : 0;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else out[key] = String(value).slice(0, 100);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Firebase Analytics — events appear in Firebase Console → Analytics → Events
 * (and DebugView when the device is in analytics debug mode).
 */
export const firebaseAnalytics = {
  init: async () => {
    if (!appConfig.isFirebaseConfigured) return;
    try {
      await analytics().setAnalyticsCollectionEnabled(true);
      await analytics().logAppOpen();
      if (__DEV__) logger.log('[Firebase Analytics] enabled + app_open');
    } catch (error) {
      console.warn('[Firebase Analytics] init failed:', error);
    }
  },

  setUser: async (uid: string | null, properties?: { role?: string }) => {
    if (!appConfig.isFirebaseConfigured) return;
    try {
      await analytics().setUserId(uid);
      if (uid && properties?.role) {
        await analytics().setUserProperty('user_role', properties.role);
      }
      if (__DEV__) logger.log(`[Firebase Analytics] user=${uid ?? 'null'}`);
    } catch (error) {
      console.warn('[Firebase Analytics] setUser failed:', error);
    }
  },

  logEvent: async (name: string, params?: EventParams) => {
    if (!appConfig.isFirebaseConfigured) return;
    const eventName = sanitizeName(name);
    if (!eventName) return;
    try {
      await analytics().logEvent(eventName, sanitizeParams(params));
      if (__DEV__) logger.log(`[Firebase Analytics] event: ${eventName}`, params ?? '');
    } catch (error) {
      console.warn(`[Firebase Analytics] logEvent(${eventName}) failed:`, error);
    }
  },

  logScreenView: async (screenName: string, screenClass?: string) => {
    if (!appConfig.isFirebaseConfigured || !screenName) return;
    try {
      await analytics().logScreenView({
        screen_name: screenName.slice(0, 100),
        screen_class: (screenClass ?? screenName).slice(0, 100),
      });
      if (__DEV__) logger.log(`[Firebase Analytics] screen_view: ${screenName}`);
    } catch (error) {
      console.warn('[Firebase Analytics] logScreenView failed:', error);
    }
  },

  logLogin: async (method: string) => {
    await firebaseAnalytics.logEvent('login', { method });
  },

  logSignUp: async (method: string) => {
    await firebaseAnalytics.logEvent('sign_up', { method });
  },

  logSelectContent: async (contentType: string, itemId: string) => {
    await firebaseAnalytics.logEvent('select_content', {
      content_type: contentType,
      item_id: itemId,
    });
  },
};
