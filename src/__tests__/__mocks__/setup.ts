const mockMMKVInstances: Record<string, Record<string, string>> = {
  default: {},
};
const mockMMKVDefaultId = 'default';

function mockGetInstance(id: string | undefined) {
  const instanceId = id ?? mockMMKVDefaultId;
  let store = mockMMKVInstances[instanceId];
  if (!store) {
    store = {};
    mockMMKVInstances[instanceId] = store;
  }
  const instanceStore: Record<string, string> = store;
  return {
    getString: (key: string) =>
      key in instanceStore ? instanceStore[key] : null,
    set: (key: string, value: string) => {
      instanceStore[key] = value;
    },
    delete: (key: string) => {
      delete instanceStore[key];
    },
    getAllKeys: () => Object.keys(instanceStore),
    clear: () => {
      for (const key of Object.keys(instanceStore)) {
        delete instanceStore[key];
      }
    },
  };
}

jest.mock('react-native-mmkv', () => {
  const MMKV = jest
    .fn()
    .mockImplementation((options?: { id?: string }) =>
      mockGetInstance(options?.id),
    );
  (MMKV as unknown as { removeMMKV: jest.Mock }).removeMMKV = jest.fn(
    (id: string) => {
      delete mockMMKVInstances[id];
    },
  );
  return {
    MMKV,
    removeMMKV: (MMKV as unknown as { removeMMKV: jest.Mock }).removeMMKV,
  };
});

jest.mock(
  'react-native-keychain',
  () => {
    const store: Record<string, { username: string; password: string }> = {};
    const serviceKey = (opts?: { service?: string }) =>
      opts?.service || 'default';
    return {
      ACCESSIBLE: {
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
      },
      SECURITY_LEVEL: {
        SECURE_HARDWARE: 'secureHardware',
        ANY: 'any',
      },
      setGenericPassword: jest.fn(
        async (
          username: string,
          password: string,
          opts?: { service?: string },
        ) => {
          store[serviceKey(opts)] = { username, password };
          return true;
        },
      ),
      getGenericPassword: jest.fn(async (opts?: { service?: string }) => {
        const key = serviceKey(opts);
        return key in store ? store[key] : false;
      }),
      resetGenericPassword: jest.fn(async (opts?: { service?: string }) => {
        delete store[serviceKey(opts)];
        return true;
      }),
    };
  },
  { virtual: true },
);

type ZustandSet = (...args: unknown[]) => void;
type ZustandGet = (...args: unknown[]) => unknown;
type ZustandStateCreator = (
  set: ZustandSet,
  get: ZustandGet,
  api: unknown,
) => unknown;
interface ZustandPersistOptions {
  name?: string;
  storage?: { getItem: (name: string) => string | null };
}

jest.mock('zustand/middleware', () => {
  // simple in-memory JSON storage adapter for tests
  return {
    persist: (config: ZustandStateCreator, options?: ZustandPersistOptions) => {
      // options may include name and storage
      const storage = options?.storage;
      const name = options?.name || 'zustand-test';

      // create a wrapped config that uses the provided set/get
      return (set: ZustandSet, get: ZustandGet, api: unknown) => {
        // persist storage helpers are intentionally unused in tests
        // (storage is accessed directly via createJSONStorage mock below)

        // if storage has existing data, try to hydrate by calling set with parsed JSON
        const existing = storage?.getItem(name);
        if (existing) {
          try {
            const parsed: unknown = JSON.parse(existing);
            // apply initial state by calling set
            set(() => parsed);
          } catch {}
        }

        return config(set, get, api);
      };
    },
    createJSONStorage: (getStorage?: () => unknown) => {
      const storage = (getStorage ? getStorage() : undefined) as
        | {
            getItem: (name: string) => string | null;
            setItem: (name: string, value: string) => void;
            removeItem: (name: string) => void;
          }
        | undefined;
      if (!storage) {
        const fallback = mockMMKVInstances[mockMMKVDefaultId]!;
        return {
          getItem: (name: string) => fallback[name] ?? null,
          setItem: (name: string, value: string) => {
            fallback[name] = value;
          },
          removeItem: (name: string) => {
            delete fallback[name];
          },
        };
      }
      return {
        getItem: (name: string) => storage.getItem(name) ?? null,
        setItem: (name: string, value: string) => storage.setItem(name, value),
        removeItem: (name: string) => storage.removeItem(name),
      };
    },
  };
});
