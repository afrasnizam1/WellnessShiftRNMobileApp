import {
  resolveAppleHealthKitBridge,
  type AppleHealthKitBridge,
} from './appleHealthKitBridge';

function nativeModule(): AppleHealthKitBridge {
  const native: AppleHealthKitBridge = {
    isAvailable: () => undefined,
    initHealthKit: () => undefined,
  };
  // New-architecture native methods are non-enumerable, which is what
  // react-native-health's Object.assign misses.
  Object.defineProperty(native, 'isAvailable', {
    value: native.isAvailable,
    enumerable: false,
  });
  Object.defineProperty(native, 'initHealthKit', {
    value: native.initHealthKit,
    enumerable: false,
  });
  return native;
}

function libraryExport(native: object): object {
  return Object.assign({}, native, {
    Constants: { Permissions: { Steps: 'Steps' } },
  });
}

describe('resolveAppleHealthKitBridge', () => {
  it('finds HealthKit when Object.assign dropped the native methods', () => {
    const native = nativeModule();
    const copied = libraryExport(native);

    expect(typeof (copied as { initHealthKit?: unknown }).initHealthKit).toBe('undefined');
    expect(typeof (copied as { isAvailable?: unknown }).isAvailable).toBe('undefined');
    expect(resolveAppleHealthKitBridge(native, copied)).toBe(native);
  });

  it('uses the package export when that copy still has the methods', () => {
    const exported: AppleHealthKitBridge = {
      isAvailable: () => undefined,
      initHealthKit: () => undefined,
    };
    expect(resolveAppleHealthKitBridge(undefined, exported)).toBe(exported);
  });

  it('returns null when neither side can connect', () => {
    const copied = libraryExport(nativeModule());
    expect(resolveAppleHealthKitBridge(undefined, copied)).toBe(null);
  });
});
