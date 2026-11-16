import { appConfig } from '../config/appConfig';
import { isFirebaseReady } from './firebaseReady';
import { logger } from '../utils/logger';

export const appCheckService = {
  init: async () => {
    if (!isFirebaseReady() || !appConfig.enableAppCheck) return;

    // Avoid blocking local Simulator/emulator runs without a registered debug token.
    if (__DEV__ && !appConfig.appCheckDebugToken) {
      logger.log(
        '[App Check] skipped in __DEV__ (set appConfig.appCheckDebugToken from Firebase Console → App Check → Debug tokens)',
      );
      return;
    }

    try {
      const appCheck = require('@react-native-firebase/app-check').default;
      const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
      provider.configure({
        android: {
          provider: __DEV__ ? 'debug' : 'playIntegrity',
          debugToken: appConfig.appCheckDebugToken || undefined,
        },
        apple: {
          provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
          debugToken: appConfig.appCheckDebugToken || undefined,
        },
      });

      await appCheck().initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      });
    } catch (e) {
      console.warn('App Check init failed:', e);
    }
  },
};
