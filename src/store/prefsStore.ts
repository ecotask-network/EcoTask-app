import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';

const storage = new MMKV({ id: 'prefs-storage' });
const zustandMMKVStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface QuietHours {
  from: string;
  to: string;
}

// Create default notification preferences with all types enabled
function makeDefaultNotificationPrefs() {
  const vals: Record<string, boolean> = {};
  Object.values(NOTIFICATION_TYPES).forEach(t => (vals[t] = true));
  return vals;
}

// Merge stored notification preferences with defaults, ensuring any new types are enabled by default

export function mergeNotificationDefaults(
  stored: Record<string, boolean> | null,
): Record<string, boolean> {
  const defaults = makeDefaultNotificationPrefs();
  if (!stored) {
    return defaults;
  }
  return { ...defaults, ...stored };
}

interface PrefsState {
  allEnabled: boolean;
  notificationPrefs: Record<string, boolean>;
  quietHours: QuietHours;
  scheduledNotificationIds: Record<string, string[] | undefined>; // type -> ids
  toggleType: (type: string, enabled: boolean) => void;
  setAllEnabled: (enabled: boolean) => void;
  setQuietHours: (from: string, to: string) => void;
  addScheduledId: (type: string, id: string) => void;
  removeScheduledId: (type: string, id: string) => void;
}

// Zustand store for user preferences, including notification settings
export const usePrefsStore = create<PrefsState>()(
  persist(
    set => ({
      allEnabled: true,
      notificationPrefs: makeDefaultNotificationPrefs(),
      quietHours: { from: '22:00', to: '07:00' },
      scheduledNotificationIds: {},
      toggleType: (type, enabled) => {
        // update preference synchronously so callers see immediate change
        set(s => ({
          notificationPrefs: { ...s.notificationPrefs, [type]: enabled },
        }));

        // if disabling, cancel any scheduled notifications asynchronously
        if (!enabled) {
          void (async () => {
            const ids =
              usePrefsStore.getState().scheduledNotificationIds[type] || [];
            if (ids.length > 0) {
              try {
                const { default: notifee } =
                  await import('@notifee/react-native');
                await Promise.all(
                  ids.map(id =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (notifee as any).cancelNotification(id).catch(() => null),
                  ),
                );
              } catch {
                // notifee not available or cancel failed; best-effort
              }
            }
            usePrefsStore.setState(s => ({
              scheduledNotificationIds: {
                ...s.scheduledNotificationIds,
                [type]: [],
              },
            }));
          })();
        }
      },
      setAllEnabled: enabled => set(() => ({ allEnabled: enabled })),
      setQuietHours: (from, to) => set(() => ({ quietHours: { from, to } })),
      addScheduledId: (type, id) =>
        set(s => ({
          scheduledNotificationIds: {
            ...s.scheduledNotificationIds,
            [type]: [...(s.scheduledNotificationIds[type] || []), id],
          },
        })),
      removeScheduledId: (type, id) =>
        set(s => ({
          scheduledNotificationIds: {
            ...s.scheduledNotificationIds,
            [type]: (s.scheduledNotificationIds[type] || []).filter(
              i => i !== id,
            ),
          },
        })),
    }),
    {
      name: 'prefs-storage',
      storage: createJSONStorage(() => zustandMMKVStorage),
      // zustand's persist option calls this once with the pre-hydration
      // state and expects the *return value* to be the post-hydration
      // callback `(state?, error?) => void` — it does not call a further
      // nested function, so any extra level of wrapping here is dead code
      // that silently never runs.
      onRehydrateStorage: () => (persisted, error) => {
        if (error != null || !persisted) {
          return;
        }
        const merged = mergeNotificationDefaults(persisted.notificationPrefs);
        usePrefsStore.setState({ notificationPrefs: merged });
      },
    },
  ),
);

export default usePrefsStore;
