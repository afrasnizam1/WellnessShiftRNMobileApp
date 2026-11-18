// src/services/healthkit.ts
// Unified health data access — Apple HealthKit (iOS) + Health Connect (Android)

import { NativeModules, Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import type { HealthInputOptions, HealthKitPermissions, HealthValue } from 'react-native-health';
import type { ActivitySnapshot, DailyActivityPoint } from '../types';
import {
  buildEmptyHistory,
  dateKey,
  lastNDays,
} from '../utils/activityHistoryHelpers';
import { resolveAppleHealthKitBridge, type AppleHealthKitBridge } from './appleHealthKitBridge';
import { healthConnectService } from './healthConnect';
import { healthKitStorage } from './healthKitStorage';

interface NativeAppleHealthKit extends AppleHealthKitBridge {
  getStepCount: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue) => void,
  ) => void;
  getActiveEnergyBurned: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue[]) => void,
  ) => void;
  getDistanceWalkingRunning: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue) => void,
  ) => void;
  getAppleExerciseTime: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue | HealthValue[]) => void,
  ) => void;
  getHeartRateSamples: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue[]) => void,
  ) => void;
  getSleepSamples: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue[]) => void,
  ) => void;
  getDailyStepCountSamples: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue[]) => void,
  ) => void;
  getDailyDistanceWalkingRunningSamples: (
    options: HealthInputOptions,
    callback: (err: unknown, results: HealthValue[]) => void,
  ) => void;
}

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

export function getHealthPlatformName(): string {
  return isAndroid ? 'Google Health Connect' : 'Apple Health';
}

function getNativeAppleHealthKit(): NativeAppleHealthKit | null {
  if (!isIOS) return null;
  return resolveAppleHealthKitBridge<NativeAppleHealthKit>(
    (NativeModules as { AppleHealthKit?: unknown }).AppleHealthKit,
    AppleHealthKit,
  );
}

function getPermissions(): HealthKitPermissions | null {
  const permissions = AppleHealthKit.Constants?.Permissions;
  if (!permissions) return null;
  return {
    permissions: {
      read: [
        permissions.Steps,
        permissions.DistanceWalkingRunning,
        permissions.ActiveEnergyBurned,
        permissions.AppleExerciseTime,
        permissions.HeartRate,
        permissions.SleepAnalysis,
        permissions.Weight,
        permissions.Height,
        permissions.BloodPressureDiastolic,
        permissions.BloodPressureSystolic,
        permissions.BloodGlucose,
        permissions.OxygenSaturation,
        permissions.RespiratoryRate,
      ],
      write: [],
    },
  };
}

const EMPTY_ACTIVITY: ActivitySnapshot = {
  steps: 0,
  calories: 0,
  distanceKm: 0,
  exerciseMinutes: 0,
  sleepHours: 0,
};

let healthKitInitialized = false;
let lastConnectError: string | null = null;

function healthKitErrorMessage(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return 'Apple Health did not finish the permission request.';
}

async function requestPermissionsIOS(): Promise<boolean> {
  lastConnectError = null;
  const native = getNativeAppleHealthKit();
  const permissions = getPermissions();
  if (!native || !permissions) {
    lastConnectError = 'Apple Health is not available in this build.';
    return false;
  }
  return new Promise((resolve) => {
    native.initHealthKit(permissions, (err) => {
      if (err) {
        healthKitInitialized = false;
        lastConnectError = healthKitErrorMessage(err);
        resolve(false);
        return;
      }

      // HealthKit never reports read access as SharingAuthorized. A finished
      // requestAuthorization is the success signal; denied reads just look empty.
      healthKitInitialized = true;
      healthKitStorage
        .setEnabled(true)
        .catch(() => {})
        .finally(() => resolve(true));
    });
  });
}

/** Re-init HealthKit on app launch when user previously connected (no dialog if already authorized). */
async function ensureInitializedIOS(): Promise<boolean> {
  if (!getNativeAppleHealthKit()) return false;
  if (healthKitInitialized) return true;
  if (!(await healthKitStorage.isEnabled())) return false;
  return requestPermissionsIOS();
}

async function isAvailableIOS(): Promise<boolean> {
  const native = getNativeAppleHealthKit();
  if (!native) {
    lastConnectError = 'Apple Health is not available in this build.';
    return false;
  }
  return new Promise((resolve) => {
    native.isAvailable((err, available) => {
      if (err) {
        lastConnectError = healthKitErrorMessage(err);
        resolve(false);
        return;
      }
      resolve(!!available);
    });
  });
}

async function isConnectedIOS(): Promise<boolean> {
  if (!(await isAvailableIOS())) return false;
  if (!(await healthKitStorage.isEnabled())) return false;
  return ensureInitializedIOS();
}

async function getTodayActivityIOS(): Promise<ActivitySnapshot> {
  const native = getNativeAppleHealthKit();
  if (!native || !(await ensureInitializedIOS())) return { ...EMPTY_ACTIVITY };

  return new Promise((resolve) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    // Overnight window: yesterday noon → now (captures Apple Watch sleep).
    const sleepStart = new Date(today);
    sleepStart.setDate(sleepStart.getDate() - 1);
    sleepStart.setHours(12, 0, 0, 0);

    const options: HealthInputOptions = {
      date: today.toISOString(),
    };

    native.getStepCount(options, (err, steps) => {
      const stepsValue = err ? 0 : steps.value;

      native.getActiveEnergyBurned(
        { startDate: today.toISOString() },
        (err2, calories) => {
          const calValue = err2
            ? 0
            : calories.reduce((sum, c) => sum + c.value, 0);

          native.getDistanceWalkingRunning(options, (err3, dist) => {
            const distValue = err3 ? 0 : (dist.value ?? 0) / 1000;

            native.getAppleExerciseTime(options, (err4, exercise) => {
              const exerciseSample = Array.isArray(exercise) ? exercise[0] : exercise;
              const exerciseValue = err4 ? 0 : exerciseSample?.value ?? 0;

              native.getHeartRateSamples(
                {
                  startDate: today.toISOString(),
                  endDate: now.toISOString(),
                  ascending: false,
                  limit: 1,
                },
                (err5, hr) => {
                  const hrValue =
                    err5 || hr.length === 0 ? undefined : hr[0].value;

                  native.getSleepSamples(
                    {
                      startDate: sleepStart.toISOString(),
                      endDate: now.toISOString(),
                    },
                    (err6, sleep) => {
                      let sleepHours = 0;
                      if (!err6 && Array.isArray(sleep)) {
                        for (const s of sleep) {
                          const value = String(s.value ?? '').toUpperCase();
                          // Exclude awake; keep ASLEEP / CORE / DEEP / REM / INBED.
                          if (value.includes('AWAKE')) continue;
                          const startMs = new Date(s.startDate).getTime();
                          const endMs = new Date(s.endDate).getTime();
                          if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
                          sleepHours += (endMs - startMs) / 3600000;
                        }
                      }

                      resolve({
                        steps: Math.round(stepsValue),
                        calories: Math.round(calValue),
                        distanceKm: Math.round(distValue * 10) / 10,
                        exerciseMinutes: Math.round(exerciseValue),
                        heartRate: hrValue ? Math.round(hrValue) : undefined,
                        sleepHours: Math.round(Math.min(sleepHours, 16) * 10) / 10,
                      });
                    },
                  );
                }
              );
            });
          });
        }
      );
    });
  });
}

function mergeDailySamples(
  days: Date[],
  stepsSamples: { startDate: string; value: number }[],
  calSamples: { startDate: string; value: number }[],
  distSamples: { startDate: string; value: number }[],
  sleepSamples: { startDate: string; endDate: string; value: string }[]
): DailyActivityPoint[] {
  const byDate = (samples: { startDate: string; value: number }[]) => {
    const map: Record<string, number> = {};
    for (const s of samples) {
      const key = dateKey(new Date(s.startDate));
      map[key] = (map[key] ?? 0) + s.value;
    }
    return map;
  };

  const stepsMap = byDate(stepsSamples);
  const calMap = byDate(calSamples);
  const distMap = byDate(distSamples);

  const sleepMap: Record<string, number> = {};
  for (const s of sleepSamples) {
    const key = dateKey(new Date(s.startDate));
    const hours =
      (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 3600000;
    sleepMap[key] = (sleepMap[key] ?? 0) + hours;
  }

  return days.map((d) => {
    const key = dateKey(d);
    return {
      date: key,
      steps: Math.round(stepsMap[key] ?? 0),
      calories: Math.round(calMap[key] ?? 0),
      distanceKm: Math.round((distMap[key] ?? 0) / 1000 * 10) / 10,
      exerciseMinutes: 0,
      sleepHours: Math.round((sleepMap[key] ?? 0) * 10) / 10,
    };
  });
}

async function getActivityHistoryIOS(days: number): Promise<DailyActivityPoint[]> {
  const native = getNativeAppleHealthKit();
  if (!native || !(await ensureInitializedIOS())) return buildEmptyHistory(days);

  const dayList = lastNDays(days);
  const start = new Date(dayList[0]);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  const range = { startDate: start.toISOString(), endDate: end.toISOString() };

  return new Promise((resolve) => {
    native.getDailyStepCountSamples(range, (errSteps, steps) => {
      native.getActiveEnergyBurned(range, (errCal, cals) => {
        native.getDailyDistanceWalkingRunningSamples(range, (errDist, dists) => {
          native.getSleepSamples(range, (errSleep, sleep) => {
            const calSamples = (cals ?? []).map((c) => ({
              startDate: c.startDate ?? c.endDate ?? '',
              value: c.value ?? 0,
            }));

            resolve(
              mergeDailySamples(
                dayList,
                (steps ?? []).map((s) => ({ startDate: s.startDate, value: s.value })),
                calSamples,
                (dists ?? []).map((d) => ({ startDate: d.startDate, value: d.value ?? 0 })),
                (sleep ?? []).map((s) => ({
                  startDate: s.startDate,
                  endDate: s.endDate,
                  value: String(s.value ?? ''),
                }))
              )
            );
          });
        });
      });
    });
  });
}

/** Cross-platform health service (HealthKit on iOS, Health Connect on Android). */
export const healthKitService = {
  /** Set when the latest connect attempt failed. Null after a success. */
  getLastConnectError: (): string | null => lastConnectError,

  requestPermissions: async (): Promise<boolean> => {
    lastConnectError = null;
    if (isAndroid) {
      const ok = await healthConnectService.requestPermissions();
      lastConnectError = healthConnectService.getLastConnectError();
      if (ok) await healthKitStorage.setEnabled(true);
      return ok;
    }
    return requestPermissionsIOS();
  },

  /** HealthKit / Health Connect exists on this device. */
  isAvailable: (): Promise<boolean> => {
    if (isAndroid) return healthConnectService.isAvailable();
    lastConnectError = null;
    return isAvailableIOS();
  },

  /** User has connected and the SDK is initialized for reads. */
  isConnected: async (): Promise<boolean> => {
    if (isAndroid) {
      if (!(await healthConnectService.isAvailable())) return false;
      return healthKitStorage.isEnabled();
    }
    return isConnectedIOS();
  },

  getTodayActivity: (): Promise<ActivitySnapshot> => {
    if (isAndroid) return healthConnectService.getTodayActivity();
    return getTodayActivityIOS();
  },

  getActivityHistory: (days = 7): Promise<DailyActivityPoint[]> => {
    if (isAndroid) return healthConnectService.getActivityHistory(days);
    return getActivityHistoryIOS(days);
  },
};
