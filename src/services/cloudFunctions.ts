import { Platform } from 'react-native';
import functions from '@react-native-firebase/functions';
import { appConfig } from '../config/appConfig';
import { isFirebaseReady } from './firebaseReady';

async function callFn<TResult>(
  name: string,
  data?: Record<string, unknown>,
): Promise<TResult | null> {
  if (!isFirebaseReady() || !appConfig.isFirebaseConfigured) return null;
  try {
    const result = await functions().httpsCallable(name)(data ?? {});
    return (result.data as TResult) ?? null;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[cloudFunctions] ${name} failed:`, error);
    }
    throw error;
  }
}

export type ConnectionCallableResult =
  | {
      alreadyLinked: true;
      patientId: string;
      clinicianId: string;
      clinicianName?: string;
    }
  | {
      alreadyLinked: false;
      request: {
        id: string;
        clinicianId: string;
        clinicianName: string;
        patientId: string;
        patientName: string;
        patientEmail: string;
        requestedAt: string;
        status: 'pending';
      };
    };

export const cloudFunctions = {
  sendClinicianConnectionRequest: (patientEmail: string) =>
    callFn<ConnectionCallableResult>('sendClinicianConnectionRequest', { patientEmail }),

  syncSubscriptionEntitlement: (input: {
    productId?: string;
    transactionId?: string;
    clear?: boolean;
  }) =>
    callFn<{ tier: string; productId?: string }>('syncSubscriptionEntitlement', {
      ...input,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    }),

  sendBrandedVerificationEmail: (continueUrl?: string) =>
    callFn<{
      sent?: boolean;
      useClientFallback?: boolean;
      alreadyVerified?: boolean;
    }>('sendBrandedVerificationEmail', {
      continueUrl: continueUrl ?? appConfig.emailVerificationContinueUrl,
    }),
};
