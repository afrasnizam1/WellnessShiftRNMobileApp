/**
 * @format
 */

// Namespaced Firebase calls are still the supported path in this app.
// Silence the modular-migration warnings so they do not cover the UI in dev.
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';

// Background / quit-state push handler must be registered at the top level, outside
// React, or Android drops data messages that arrive while the app is closed.
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {
    // The OS shows notification payloads itself; nothing extra to do here.
  });
} catch {
  // Firebase not configured in this build.
}

// Defer heavy module graph + native hooks until after AppRegistry is set up.
AppRegistry.registerComponent(appName, () => require('./App').default);
