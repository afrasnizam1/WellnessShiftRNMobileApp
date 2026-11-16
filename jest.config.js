module.exports = {
  preset: '@react-native/jest-preset',
  // Most React Native libraries ship untranspiled ESM/Flow — let Babel handle them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-firebase|@react-navigation|react-native-.*|@invertase|@notifee|@react-native-google-signin)/)',
  ],
};
