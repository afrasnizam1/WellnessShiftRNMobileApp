import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CarePlan } from '../types';
import { localNotificationService } from './localNotifications';

const KEY = 'announcedCarePlanIds';

function storageKey(uid: string) {
  return `${KEY}:${uid}`;
}

async function announcedIds(uid: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/** One system banner per care plan, even if the listener fires again. */
export async function announceNewCarePlan(uid: string, plan: CarePlan): Promise<void> {
  if (!plan.id) return;
  const seen = await announcedIds(uid);
  if (seen.has(plan.id)) return;
  seen.add(plan.id);
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify([...seen].slice(-50)));

  const from = plan.clinicianName?.trim();
  const body = from
    ? `${from} sent you “${plan.title || 'a care plan'}”`
    : 'Your clinician sent you a care plan';

  await localNotificationService.displayRemote('New care plan', body, {
    type: 'care_plan',
    planId: plan.id,
  });
}
