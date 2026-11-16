// src/services/socialAuth.ts
// Apple Sign In + Google Sign In
// Dependencies:
//   @invertase/react-native-apple-authentication
//   @react-native-google-signin/google-signin

import auth from '@react-native-firebase/auth';
import { appConfig } from '../config/appConfig';
import { userService } from './firebase';
import type { UserProfile, UserRole } from '../types';

/** True for an account Firebase created in the last two minutes (first social sign-in). */
function isJustCreated(fbUser: { metadata?: { creationTime?: string } }): boolean {
  const created = Date.parse(fbUser.metadata?.creationTime ?? '');
  return Number.isFinite(created) && Date.now() - created < 2 * 60 * 1000;
}

// ─── Apple Sign In ────────────────────────────────────────────────────────────

export async function signInWithApple(): Promise<void> {
  // Dynamic import so it only loads on iOS
  const { appleAuth } = await import('@invertase/react-native-apple-authentication');

  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  if (!appleAuthRequestResponse.identityToken) {
    throw new Error('Apple Sign In failed — no identity token');
  }

  const { identityToken, nonce } = appleAuthRequestResponse;
  const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
  await auth().signInWithCredential(appleCredential);
}

// ─── Google Sign In ───────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<void> {
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

  // Must be called once at app start (see App.tsx setup)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { idToken } = await GoogleSignin.signIn();

  if (!idToken) {
    throw new Error('Google Sign In failed — no ID token');
  }

  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(googleCredential);
}

/** Load or create a profile for the current Firebase user after social auth. */
export async function resolveCurrentUserProfile(options?: {
  consentAccepted?: boolean;
  medicalDisclaimerAcknowledged?: boolean;
  ageConfirmed?: boolean;
  /** Role chosen on the sign-up screen. Only applied to a brand-new account. */
  role?: UserRole;
}): Promise<UserProfile | null> {
  if (!appConfig.isFirebaseConfigured) return null;

  const fbUser = auth().currentUser;
  if (!fbUser) return null;

  let profile = await userService.getProfile(fbUser.uid);
  const consentFields = {
    consentAccepted: options?.consentAccepted ?? false,
    medicalDisclaimerAcknowledged: options?.medicalDisclaimerAcknowledged ?? false,
    ageConfirmed: options?.ageConfirmed ?? false,
  };

  const role: UserRole = options?.role ?? 'patient';
  if (!profile) {
    await userService.createProfile(fbUser.uid, {
      displayName: fbUser.displayName || 'User',
      email: fbUser.email || '',
      role,
      ...consentFields,
    });
    profile = await userService.getProfile(fbUser.uid);
  } else if (role === 'clinician' && profile.role === 'patient' && isJustCreated(fbUser)) {
    // The app's auth listener can create a default patient profile a moment before
    // this runs. A brand-new account that chose "clinician" must still be a clinician.
    await userService.updateProfile(fbUser.uid, { role: 'clinician', ...consentFields });
    profile = (await userService.getProfile(fbUser.uid)) ?? { ...profile, role: 'clinician' };
  } else if (options?.consentAccepted) {
    await userService.updateProfile(fbUser.uid, consentFields);
    profile = { ...profile, ...consentFields };
  }
  return profile;
}

// ─── Setup (call once in App.tsx) ────────────────────────────────────────────

export function setupGoogleSignIn(webClientId: string): void {
  // webClientId from Firebase Console → Authentication → Google → Web client ID
  import('@react-native-google-signin/google-signin').then(({ GoogleSignin }) => {
    GoogleSignin.configure({ webClientId });
  });
}
