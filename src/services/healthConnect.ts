// src/services/healthConnect.ts — Android Health Connect (steps, watch sync, etc.)
import {
  SdkAvailabilityStatus,
  aggregateRecord,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import type { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';
import type { ActivitySnapshot, DailyActivityPoint } from '../types';
import {
  buildDemoActivityHistory,
  dateKey,
  lastNDays,
} from '../utils/activityHistoryHelpers';

const READ_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'Weight' as const },
  { accessType: 'read' as const, recordType: 'Height' as const },
  { accessType: 'read' as const, recordType: 'BloodPressure' as const },
  { accessType: 'read' as const, recordType: 'BloodGlucose' as const },
  { accessType: 'read' as const, recordType: 'OxygenSaturation' as const },
  { accessType: 'read' as const, recordType: 'RespiratoryRate' as const },
];

let lastConnectError: string | null = null;

function connectErrorMessage(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return 'Health Connect did not finish the permission request.';
}

const EMPTY_ACTIVITY: ActivitySnapshot = {
  steps: 0,
  calories: 0,
  distanceKm: 0,
  exerciseMinutes: 0,
  sleepHours: 0,
};

function todayTimeRange(): TimeRangeFilter {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return {
    operator: 'between',
    startTime: start.toISOString(),
    endTime: new Date().toISOString(),
  };
}

async function ensureInitialized(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return false;
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return false;
    return await initialize();
  } catch {
    return false;
  }
}

async function getLatestHeartRate(timeRangeFilter: TimeRangeFilter): Promise<number | undefined> {
  try {
    const { records } = await readRecords('HeartRate', { timeRangeFilter, pageSize: 100 });
    let latestBpm = 0;
    let latestTime = 0;

    for (const record of records) {
      for (const sample of record.samples ?? []) {
        const t = new Date(sample.time).getTime();
        if (t >= latestTime && sample.beatsPerMinute > 0) {
          latestTime = t;
          latestBpm = sample.beatsPerMinute;
        }
      }
    }

    return latestBpm > 0 ? Math.round(latestBpm) : undefined;
  } catch {
    return undefined;
  }
}

export const healthConnectService = {
  getLastConnectError: (): string | null => lastConnectError,

  requestPermissions: async (): Promise<boolean> => {
    lastConnectError = null;
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        lastConnectError =
          'Health Connect is not installed. Install it from the Play Store, then try again.';
        return false;
      }
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        lastConnectError =
          'Health Connect needs an update from the Play Store before Wellness Shift can connect.';
        return false;
      }
      const ready = await initialize();
      if (!ready) {
        lastConnectError =
          'Health Connect could not start. Open the Health Connect app once, then try again.';
        return false;
      }
      const granted = await requestPermission(READ_PERMISSIONS);
      if (granted.length === 0) {
        lastConnectError =
          'No Health Connect data types were allowed. In Health Connect, open App permissions, choose Wellness Shift, and turn on Steps, Sleep, and Heart rate.';
        return false;
      }
      return true;
    } catch (err) {
      lastConnectError = connectErrorMessage(err);
      return false;
    }
  },

  isAvailable: async (): Promise<boolean> => {
    try {
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  getTodayActivity: async (): Promise<ActivitySnapshot> => {
    try {
      if (!(await ensureInitialized())) return { ...EMPTY_ACTIVITY };

      const timeRangeFilter = todayTimeRange();

      const [stepsAgg, caloriesAgg, distanceAgg, exerciseAgg, heartRate] = await Promise.all([
        aggregateRecord({ recordType: 'Steps', timeRangeFilter }).catch(() => null),
        aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }).catch(() => null),
        aggregateRecord({ recordType: 'Distance', timeRangeFilter }).catch(() => null),
        aggregateRecord({ recordType: 'ExerciseSession', timeRangeFilter }).catch(() => null),
        getLatestHeartRate(timeRangeFilter),
      ]);

      const exerciseSeconds = exerciseAgg?.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0;

      return {
        steps: Math.round(stepsAgg?.COUNT_TOTAL ?? 0),
        calories: Math.round(caloriesAgg?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0),
        distanceKm: Math.round((distanceAgg?.DISTANCE?.inKilometers ?? 0) * 10) / 10,
        exerciseMinutes: Math.round(exerciseSeconds / 60),
        heartRate,
      };
    } catch {
      return { ...EMPTY_ACTIVITY };
    }
  },

  getActivityHistory: async (days = 7): Promise<DailyActivityPoint[]> => {
    try {
      if (!(await ensureInitialized())) return buildDemoActivityHistory(days);

      const dayList = lastNDays(days);
      const points: DailyActivityPoint[] = [];

      for (const day of dayList) {
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        const end = new Date(day);
        end.setHours(23, 59, 59, 999);
        const timeRangeFilter: TimeRangeFilter = {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        };

        const [stepsAgg, caloriesAgg, distanceAgg, exerciseAgg] = await Promise.all([
          aggregateRecord({ recordType: 'Steps', timeRangeFilter }).catch(() => null),
          aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }).catch(() => null),
          aggregateRecord({ recordType: 'Distance', timeRangeFilter }).catch(() => null),
          aggregateRecord({ recordType: 'ExerciseSession', timeRangeFilter }).catch(() => null),
        ]);

        const exerciseSeconds = exerciseAgg?.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0;
        points.push({
          date: dateKey(day),
          steps: Math.round(stepsAgg?.COUNT_TOTAL ?? 0),
          calories: Math.round(caloriesAgg?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0),
          distanceKm: Math.round((distanceAgg?.DISTANCE?.inKilometers ?? 0) * 10) / 10,
          exerciseMinutes: Math.round(exerciseSeconds / 60),
        });
      }

      const hasData = points.some((p) => p.steps > 0 || p.calories > 0);
      if (!hasData) {
        const today = await healthConnectService.getTodayActivity();
        return buildDemoActivityHistory(days, today);
      }
      return points;
    } catch {
      return buildDemoActivityHistory(days);
    }
  },
};
