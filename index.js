/**
 * @format
 */

// Namespaced Firebase calls are still the supported path in this app.
// Silence the modular-migration warnings so they do not cover the UI in dev.
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';

// Defer heavy module graph + native hooks until after AppRegistry is set up.
AppRegistry.registerComponent(appName, () => require('./App').default);
