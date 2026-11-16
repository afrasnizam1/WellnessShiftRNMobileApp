import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AUTH_BACKGROUND } from '../../theme/authTheme';
import { Colors, Typography } from '../../theme';

type Props = {
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

/**
 * Shown when a signed-in user's profile could not be loaded (offline, slow network).
 * Without it the app fell back to the guest intro while the person was still signed in.
 */
export default function ProfileLoadErrorScreen({ onRetry, onSignOut }: Props) {
  const [busy, setBusy] = useState<'retry' | 'signout' | null>(null);

  const run = async (kind: 'retry' | 'signout', fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>We couldn’t load your account</Text>
      <Text style={styles.message}>
        Check your internet connection and try again. You’re still signed in.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={() => run('retry', onRetry)}
        accessibilityRole="button"
        testID="profile_load_retry"
      >
        {busy === 'retry' ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryText}>Try again</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        onPress={() => run('signout', onSignOut)}
        accessibilityRole="button"
        testID="profile_load_sign_out"
      >
        <Text style={styles.secondaryText}>{busy === 'signout' ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AUTH_BACKGROUND,
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.size.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: Typography.size.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  primary: {
    marginTop: 8,
    minWidth: 200,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryText: { color: Colors.white, fontSize: Typography.size.base, fontWeight: '700' },
  secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.size.base, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
