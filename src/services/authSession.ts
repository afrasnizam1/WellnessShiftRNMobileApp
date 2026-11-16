import auth from '@react-native-firebase/auth';
import { useAppStore } from '../store';
import { contentsquareService } from './contentsquareService';
import { firebaseAnalytics } from './firebaseAnalytics';
import { notificationService } from './notifications';
import type { UserProfile } from '../types';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Clears Firebase, Google, analytics identity, and all local session state. */
export async function signOutCurrentUser(user?: UserProfile | null): Promise<void> {
  const profile = user ?? useAppStore.getState().user;

  if (profile) {
    await withTimeout(
      notificationService.unregisterDevice(profile.uid, profile.role),
      4000,
    ).catch(() => {});
  }

  // Google Sign-In can hang on Android when the user never signed in with Google.
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await withTimeout(GoogleSignin.signOut(), 3000);
  } catch {
    // Not signed in with Google, module unavailable, or timed out.
  }

  try {
    if (auth().currentUser) {
      await withTimeout(auth().signOut(), 5000);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[authSession] Firebase signOut failed; clearing local session anyway.', error);
    }
  }

  // Device-wide state belongs to the account that just left.
  await Promise.all([
    import('./pendingOnboardingStorage').then((m) => m.pendingOnboardingStorage.clear()),
    import('./subscriptionService').then((m) => m.subscriptionService.clearCachedTier()),
    import('./localNotifications').then((m) => m.localNotificationService.cancelAll()),
  ]).catch(() => {});

  contentsquareService.clearUserIdentity();
  firebaseAnalytics.setUser(null).catch(() => {});
  firebaseAnalytics.logEvent('logout').catch(() => {});

  // Clear session without leaving the app stuck on the auth loading gate.
  // (resetSession alone sets isAuthLoading: true and nothing clears it if the
  // Firebase auth listener does not fire — e.g. demo / already-signed-out.)
  useAppStore.getState().resetSession({ bumpEpoch: true });
  useAppStore.getState().setAuthLoading(false);
}
