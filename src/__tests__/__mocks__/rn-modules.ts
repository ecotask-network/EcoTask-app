jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    }),
  ),
}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 123),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (key: string) => store[key] ?? null,
      set: (key: string, value: string) => {
        store[key] = value;
      },
      delete: (key: string) => {
        delete store[key];
      },
    })),
  };
});

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    STELLAR_NETWORK: 'testnet',
    BACKEND_URL: 'http://localhost:3000',
    ECO_TOKEN_ASSET_CODE: 'ECO',
    ECO_TOKEN_ISSUER: 'TESTISSUER',
  },
}));

jest.mock(
  'react-native-keychain',
  () => {
    const store: Record<string, { username: string; password: string }> = {};

    return {
      ACCESSIBLE: {
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
      },
      setGenericPassword: jest.fn(
        async (
          username: string,
          password: string,
          opts?: { service?: string },
        ) => {
          const key = opts?.service || 'default';
          store[key] = { username, password };
          return true;
        },
      ),
      getGenericPassword: jest.fn(async (opts?: { service?: string }) => {
        const key = opts?.service || 'default';
        return key in store ? store[key] : false;
      }),
      resetGenericPassword: jest.fn(async (opts?: { service?: string }) => {
        const key = opts?.service || 'default';
        delete store[key];
        return true;
      }),
    };
  },
  { virtual: true },
);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue('notifee-id-1'),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
  },
  displayNotification: jest.fn().mockResolvedValue('notifee-id-1'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

(() => {
  const g = globalThis as typeof globalThis & {
    crypto?: { getRandomValues?: (array: Uint8Array) => void };
  };

  if (
    typeof g.crypto === 'undefined' ||
    typeof g.crypto.getRandomValues !== 'function'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { webcrypto } = require('crypto');
    g.crypto = webcrypto;
  }
})();



