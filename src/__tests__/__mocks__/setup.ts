const __MMKV_STORE__: Record<string, string> = {};

jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (key: string) => __MMKV_STORE__[key] ?? null,
      set: (key: string, value: string) => {
        __MMKV_STORE__[key] = value;
      },
      delete: (key: string) => {
        delete __MMKV_STORE__[key];
      },
    })),
  };
});

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
    createJSONStorage: () => ({
      getItem: (name: string) => __MMKV_STORE__[name] ?? null,
      setItem: (name: string, value: string) => {
        __MMKV_STORE__[name] = value;
      },
      removeItem: (name: string) => {
        delete __MMKV_STORE__[name];
      },
    }),
  };
});
