/**
 * react-native-health 1.19 does:
 *   Object.assign({}, NativeModules.AppleHealthKit, { Constants })
 *
 * On React Native 0.76+ (new architecture, enabled in this app) native module
 * methods are non-enumerable, so that copy drops initHealthKit and isAvailable.
 * Connect then never calls HealthKit. Resolve the live module at call time.
 */
export interface AppleHealthKitBridge {
  isAvailable: (callback: (err: unknown, available: boolean) => void) => void;
  initHealthKit: (permissions: unknown, callback: (err: unknown) => void) => void;
}

export function isAppleHealthKitBridge(value: unknown): value is AppleHealthKitBridge {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { isAvailable?: unknown; initHealthKit?: unknown };
  return typeof candidate.isAvailable === 'function' && typeof candidate.initHealthKit === 'function';
}

export function resolveAppleHealthKitBridge<T extends AppleHealthKitBridge>(
  nativeModule: unknown,
  packageExport: unknown,
): T | null {
  if (isAppleHealthKitBridge(nativeModule)) return nativeModule as T;
  if (isAppleHealthKitBridge(packageExport)) return packageExport as T;
  return null;
}
