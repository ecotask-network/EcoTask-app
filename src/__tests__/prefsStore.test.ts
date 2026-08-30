import { usePrefsStore, mergeNotificationDefaults } from '../store/prefsStore';
import { NOTIFICATION_TYPES } from '../services/notifications';

describe('prefs defaults merge', () => {
  test('missing future type defaults to true', () => {
    const stored: Record<string, boolean> = {};
    const existingType = Object.values(NOTIFICATION_TYPES)[0]!;
    stored[existingType] = false;

    const merged = mergeNotificationDefaults(stored);

    Object.values(NOTIFICATION_TYPES).forEach(t => {
      if (t === existingType) {
        expect(merged[t]).toBe(false);
      } else {
        expect(merged[t]).toBe(true);
      }
    });
  });
});

describe('onRehydrateStorage', () => {
  // Exercises the *actual* registered onRehydrateStorage function via
  // zustand's public persist API, rather than re-simulating storage/MMKV
  // timing. Zustand v4 calls this outer function once (pre-hydration) and
  // expects its return value to be invoked again post-hydration with
  // (hydratedState, error) — see https://zustand.docs.pmnd.rs/reference/middlewares/persist
  // This proves the real wiring behaves correctly, since re-implementing
  // the callback in the test would only prove the reimplementation works.
  function runRehydrate(hydratedNotificationPrefs: Record<string, boolean>) {
    const options = usePrefsStore.persist.getOptions();
    const postRehydrationCallback = options.onRehydrateStorage?.(
      usePrefsStore.getState(),
    );
    postRehydrationCallback?.(
      {
        ...usePrefsStore.getState(),
        notificationPrefs: hydratedNotificationPrefs,
      },
      undefined,
    );
  }

  afterEach(() => {
    // Reset to defaults so tests don't leak state into each other.
    usePrefsStore.setState({
      notificationPrefs: mergeNotificationDefaults(null),
    });
  });

  test('backfills a newly-introduced notification type as enabled', () => {
    // Simulates a user upgrading from a version of the app that predates
    // PROOF_TIMEOUT — their on-disk prefs simply don't have the key.
    runRehydrate({
      task_nearby: true,
      reward_confirmed: true,
      proof_rejected: true,
      streak_reminder: true,
      new_task: true,
      // proof_timeout intentionally absent
    });

    expect(usePrefsStore.getState().notificationPrefs.proof_timeout).toBe(true);
  });

  test('preserves an explicitly disabled preference', () => {
    runRehydrate({
      task_nearby: true,
      reward_confirmed: false, // user turned this off on purpose
      proof_rejected: true,
      proof_timeout: true,
      streak_reminder: true,
      new_task: true,
    });

    expect(usePrefsStore.getState().notificationPrefs.reward_confirmed).toBe(
      false,
    );
  });

  test('handles a completely empty stored prefs object by falling back to full defaults', () => {
    runRehydrate({});

    Object.values(NOTIFICATION_TYPES).forEach(type => {
      expect(usePrefsStore.getState().notificationPrefs[type]).toBe(true);
    });
  });

  test('is a no-op when the post-hydration state is undefined (hydration error path)', () => {
    usePrefsStore.setState({ notificationPrefs: { task_nearby: false } });

    const options = usePrefsStore.persist.getOptions();
    const postRehydrationCallback = options.onRehydrateStorage?.(
      usePrefsStore.getState(),
    );
    postRehydrationCallback?.(undefined, new Error('storage read failed'));

    // State should be untouched — no merge should be attempted.
    expect(usePrefsStore.getState().notificationPrefs.task_nearby).toBe(false);
  });
});
