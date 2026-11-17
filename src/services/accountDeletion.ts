import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { FS } from './firestoreSchema';
import { isFirebaseReady } from './firebaseReady';
import { signOutCurrentUser } from './authSession';

const USER_SUBCOLLECTIONS = [
  'wellnessScores',
  'dailyPlans',
  'carePlans',
  'habits',
  'goals',
  'friends',
  'accountabilityBoard',
  'stats',
  'achievements',
  'dailyCheckIns',
  'activePrograms',
  'completedPrograms',
] as const;

async function deleteCollectionDocs(
  collectionRef: FirebaseFirestoreTypes.CollectionReference,
  batchSize = 40,
): Promise<void> {
  // Recursively delete docs in batches (client SDK has no recursive delete).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await collectionRef.limit(batchSize).get();
    if (snap.empty) return;
    const batch = firestore().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

async function deleteQueryDocs(
  query: FirebaseFirestoreTypes.Query,
  batchSize = 40,
): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) return;
    const batch = firestore().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

async function deleteUserSubcollections(uid: string): Promise<void> {
  const userRef = firestore().collection(FS.users).doc(uid);
  await Promise.all(
    USER_SUBCOLLECTIONS.map((name) =>
      deleteCollectionDocs(userRef.collection(name)).catch(() => {}),
    ),
  );
}

async function deleteMessageThreadsForUser(uid: string): Promise<void> {
  const db = firestore();
  for (const field of ['patientId', 'clinicianId'] as const) {
    try {
      const snap = await db.collection('messageThreads').where(field, '==', uid).get();
      for (const thread of snap.docs) {
        await deleteCollectionDocs(thread.ref.collection('messages')).catch(() => {});
        await thread.ref.delete().catch(() => {});
      }
    } catch {
      // Query may lack an index in some environments — skip and continue wipe.
    }
  }
}

async function deleteCarePlansAndNotifications(uid: string): Promise<void> {
  const db = firestore();
  await Promise.all([
    deleteQueryDocs(db.collection(FS.customCarePlans).where('patientId', '==', uid)).catch(
      () => {},
    ),
    deleteQueryDocs(db.collection(FS.customCarePlans).where('clinicianId', '==', uid)).catch(
      () => {},
    ),
    deleteQueryDocs(db.collection(FS.notifications).where('patientId', '==', uid)).catch(
      () => {},
    ),
    deleteQueryDocs(db.collection(FS.notificationQueue).where('patientId', '==', uid)).catch(
      () => {},
    ),
    deleteQueryDocs(db.collection('inviteCodes').where('clinicianId', '==', uid)).catch(() => {}),
  ]);
}

async function unlinkClinicianRelationships(uid: string): Promise<void> {
  const db = firestore();

  // Patient → remove mirror on clinician + denormalized array entry.
  try {
    const patientSnap = await db.collection(FS.patients).doc(uid).get();
    const clinicianId =
      (patientSnap.data()?.linkedClinicianId as string | undefined) ||
      (await db.collection(FS.users).doc(uid).get()).data()?.clinicianId;
    if (typeof clinicianId === 'string' && clinicianId.length > 0) {
      await db
        .collection(FS.clinicians)
        .doc(clinicianId)
        .collection('linkedPatients')
        .doc(uid)
        .delete()
        .catch(() => {});
      await db
        .collection(FS.users)
        .doc(clinicianId)
        .set({ linkedPatients: firestore.FieldValue.arrayRemove(uid) }, { merge: true })
        .catch(() => {});
    }
  } catch {
    // best effort
  }

  // Clinician → wipe linkedPatients subcollection.
  await deleteCollectionDocs(
    db.collection(FS.clinicians).doc(uid).collection('linkedPatients'),
  ).catch(() => {});
}

async function deleteTopLevelUserDocs(uid: string): Promise<void> {
  const db = firestore();
  const refs = [
    db.collection(FS.users).doc(uid),
    db.collection(FS.patients).doc(uid),
    db.collection(FS.clinicians).doc(uid),
    db.collection(FS.userProfiles).doc(uid),
    db.collection(FS.userTrials).doc(uid),
    db.collection(FS.fcmTokens).doc(uid),
  ];
  await Promise.all(refs.map((ref) => ref.delete().catch(() => {})));
}

/** Clears on-device user data (cycle logs, meal photos metadata, health records, onboarding). */
async function clearLocalUserData(uid: string): Promise<void> {
  const known = [
    `menstrual_cycle_v2_${uid}`,
    `menstrual_cycle_data_${uid}`,
    `food_log_v1_${uid}`,
    `health_records_v1_${uid}`,
    `seenCarePlanIds:${uid}`,
  ];
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const matching = allKeys.filter((key) => key.includes(uid));
    await AsyncStorage.multiRemove([...new Set([...known, ...matching])]);
  } catch {
    await AsyncStorage.multiRemove(known).catch(() => {});
  }
}

const RECENT_SIGN_IN_MS = 5 * 60 * 1000;

const SIGN_IN_AGAIN_MESSAGE =
  'For your security, please sign out, sign back in, then delete your account. Nothing has been deleted.';

/**
 * Makes sure Firebase will accept `currentUser.delete()` before any data is removed.
 * Sign in with Apple users re-confirm with Apple (which also yields the authorization
 * code needed to revoke their token). Others must have signed in within 5 minutes.
 * Returns the Apple authorization code to revoke, if any.
 */
async function confirmRecentSignIn(
  currentUser: any,
): Promise<string | null> {
  const providers: string[] = (currentUser.providerData ?? []).map(
    (p: { providerId: string }) => p.providerId,
  );

  if (Platform.OS === 'ios' && providers.includes('apple.com')) {
    const { appleAuth } = await import('@invertase/react-native-apple-authentication');
    let response;
    try {
      response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [],
      });
    } catch (error: any) {
      if (String(error?.code) === '1001') {
        throw new Error('Account deletion was cancelled. Nothing has been deleted.');
      }
      throw new Error('Could not confirm your Apple ID. Nothing has been deleted.');
    }
    if (!response.identityToken) {
      throw new Error('Could not confirm your Apple ID. Nothing has been deleted.');
    }
    await currentUser.reauthenticateWithCredential(
      auth.AppleAuthProvider.credential(response.identityToken, response.nonce),
    );
    return response.authorizationCode ?? null;
  }

  const last = Date.parse(currentUser.metadata?.lastSignInTime ?? '');
  if (!Number.isFinite(last) || Date.now() - last > RECENT_SIGN_IN_MS) {
    throw new Error(SIGN_IN_AGAIN_MESSAGE);
  }
  return null;
}

/**
 * Permanently deletes the signed-in user's Firestore data, local cache, then Auth account.
 * Clears local session afterwards. Throws with a friendly message if re-auth is required.
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  if (!isFirebaseReady()) {
    throw new Error('Account deletion is unavailable right now. Please try again later.');
  }

  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to delete your account.');
  }

  const uid = currentUser.uid;

  // Confirm a fresh sign-in BEFORE deleting anything, so a "please sign in again"
  // failure can never leave the account alive with its data already wiped.
  const appleAuthorizationCode = await confirmRecentSignIn(currentUser);

  await deleteMessageThreadsForUser(uid);
  await deleteCarePlansAndNotifications(uid);
  await unlinkClinicianRelationships(uid);
  await deleteUserSubcollections(uid);
  await deleteTopLevelUserDocs(uid);
  await clearLocalUserData(uid);

  // Apple requires apps that offer Sign in with Apple to revoke the user's
  // token when the account is deleted.
  if (appleAuthorizationCode) {
    await auth()
      .revokeToken(appleAuthorizationCode)
      .catch((error: unknown) => console.warn('[accountDeletion] Apple token revoke failed:', error));
  }

  try {
    await currentUser.delete();
  } catch (error: any) {
    if (error?.code === 'auth/requires-recent-login') {
      throw new Error(SIGN_IN_AGAIN_MESSAGE.replace(' Nothing has been deleted.', ''));
    }
    throw error instanceof Error
      ? error
      : new Error('Could not delete your account. Please try again or contact support.');
  }

  await signOutCurrentUser().catch(() => {});
}
