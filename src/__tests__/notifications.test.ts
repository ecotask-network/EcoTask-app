/**
 * notifications.test.ts
 *
 * Covers:
 *  1. Permission handling — granted / denied
 *  2. FCM token registration — success, Firebase unavailable, permission denied
 *  3. Token refresh listener — callback forwarding
 *  4. sendTokenToServer — payload shape
 *  5. scheduleLocalNotification — fires / suppressed
 *  6. Notification preference suppression (type-level and global)
 *  7. scheduleDailyStreakReminder — suppressed when task completed today,
 *     suppressed when preference off, fires otherwise with correct payload shape
 */

import './__mocks__/setup';

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them (jest hoists these)
// ---------------------------------------------------------------------------

// api client (static import in notifications.ts)
// NOTE: mockApiPost must be declared inside the factory because jest.mock
// is hoisted above const declarations (temporal dead zone issue).
jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: {} }) },
}));

// @notifee/react-native
jest.mock('@notifee/react-native', () => ({
  displayNotification: jest.fn().mockResolvedValue({ id: 'notifee-id-1' }),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

// Firebase messaging adapter — singleton so every getMessaging() call
// returns the same instance (tests can then mock methods on one handle).
jest.mock('../services/firebaseMessaging', () => {
  const instance = {
    getToken: jest.fn().mockResolvedValue('fcm-token-default'),
    onTokenRefresh: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    onMessage: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    requestPermission: jest.fn().mockResolvedValue(1),
  };
  return {
    getMessaging: jest.fn(() => instance),
  };
});

// react-native — mock Platform + PermissionsAndroid at the barrel export
// level so that `import { Platform, PermissionsAndroid } from 'react-native'`
// resolves correctly (the react-native Jest preset doesn't propagate
// sub-path mocks like react-native/Libraries/.../PermissionsAndroid).
jest.mock('react-native', () => {
  const PermissionsAndroid = {
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn().mockResolvedValue('granted'),
    check: jest.fn().mockResolvedValue(true),
    requestMultiple: jest.fn().mockResolvedValue({}),
  };
  const Platform = {
    OS: 'android' as const,
    select: <T>(obj: Record<string, T>) => obj.android ?? obj.default,
  };
  return {
    __esModule: true,
    Platform,
    PermissionsAndroid,
    default: { Platform, PermissionsAndroid },
  };
});

// ---------------------------------------------------------------------------
// Subject imports (after mocks)
// ---------------------------------------------------------------------------

import {
  requestNotificationPermission,
  registerForPushNotifications,
  listenForTokenRefresh,
  sendTokenToServer,
  scheduleLocalNotification,
  scheduleDailyStreakReminder,
  onNotificationReceived,
  NOTIFICATION_TYPES,
  NotificationPayload,
} from '../services/notifications';
import usePrefsStore from '../store/prefsStore';
import { useActivityStore } from '../store/activityStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Retrieve mock handles after jest.mock hoisting.
function getPermissionsAndroidMock() {
  return jest.requireMock('react-native').PermissionsAndroid;
}
function getApiMock() {
  return jest.requireMock('../services/api').default;
}
function getNotifee() {
  return jest.requireMock('@notifee/react-native');
}
function getFirebaseMock() {
  // getMessaging() is called fresh each time — grab the instance it returns
  const { getMessaging } = jest.requireMock('../services/firebaseMessaging');
  return getMessaging();
}

function grantPermission() {
  getPermissionsAndroidMock().request.mockResolvedValue('granted');
}

function denyPermission() {
  getPermissionsAndroidMock().request.mockResolvedValue('denied');
}

function resetPrefs() {
  usePrefsStore.getState().setAllEnabled(true);
  const defaults = Object.values(NOTIFICATION_TYPES).reduce<
    Record<string, boolean>
  >((acc, t) => ({ ...acc, [t]: true }), {});
  // Also reset quietHours to '00:00'–'00:00' (disabled) so tests are
  // never suppressed by the default 22:00–07:00 window when run during
  // those hours in CI or other environments.
  usePrefsStore.setState({
    notificationPrefs: defaults,
    quietHours: { from: '00:00', to: '00:00' },
  });
}

function resetActivity() {
  useActivityStore.getState().clearActivities();
}

// ---------------------------------------------------------------------------
// 1. Permission handling
// ---------------------------------------------------------------------------

describe('requestNotificationPermission', () => {
  test('returns true when Android permission is GRANTED', async () => {
    grantPermission();
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  test('returns false when Android permission is DENIED', async () => {
    denyPermission();
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. FCM token registration
// ---------------------------------------------------------------------------

describe('registerForPushNotifications', () => {
  beforeEach(() => {
    grantPermission();
  });

  afterEach(() => {
    getFirebaseMock().getToken.mockReset();
  });

  test('returns FCM token string on success', async () => {
    getFirebaseMock().getToken.mockResolvedValueOnce('fcm-token-abc');
    const token = await registerForPushNotifications();
    expect(token).toBe('fcm-token-abc');
    expect(getFirebaseMock().getToken).toHaveBeenCalledTimes(1);
  });

  test('returns null when permission is denied', async () => {
    denyPermission();
    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  test('returns null when Firebase getToken throws (missing google-services.json)', async () => {
    getFirebaseMock().getToken.mockRejectedValueOnce(
      new Error('Firebase not configured'),
    );
    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  test('returns null when getToken returns null', async () => {
    getFirebaseMock().getToken.mockResolvedValueOnce(null);
    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Token refresh listener
// ---------------------------------------------------------------------------

describe('listenForTokenRefresh', () => {
  test('registers an onTokenRefresh handler', () => {
    const unsubMock = jest.fn();
    getFirebaseMock().onTokenRefresh.mockReturnValueOnce(unsubMock);

    listenForTokenRefresh(jest.fn());

    expect(getFirebaseMock().onTokenRefresh).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  test('forwards the new token to the provided callback', () => {
    const received: string[] = [];
    let capturedHandler: ((token: string) => void) | null = null;

    getFirebaseMock().onTokenRefresh.mockImplementationOnce(
      (handler: (token: string) => void) => {
        capturedHandler = handler;
        return jest.fn();
      },
    );

    listenForTokenRefresh(t => received.push(t));

    if (capturedHandler != null) {
      (capturedHandler as (token: string) => void)('rotated-token-xyz');
    }
    expect(received).toContain('rotated-token-xyz');
  });

  test('returns an unsubscribe function that does not throw', () => {
    const unsubMock = jest.fn();
    getFirebaseMock().onTokenRefresh.mockReturnValueOnce(unsubMock);

    const unsub = listenForTokenRefresh(jest.fn());
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4. sendTokenToServer — payload shape
// ---------------------------------------------------------------------------

describe('sendTokenToServer', () => {
  beforeEach(() => {
    getApiMock().post.mockResolvedValue({ data: {} });
  });

  test('POSTs token to /notifications/register', async () => {
    await sendTokenToServer('test-token-123');
    expect(getApiMock().post).toHaveBeenCalledWith('/notifications/register', {
      token: 'test-token-123',
    });
  });

  test('does not throw when the API call fails', async () => {
    getApiMock().post.mockRejectedValueOnce(new Error('Network error'));
    await expect(sendTokenToServer('tok')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. scheduleLocalNotification — fires / suppressed
// ---------------------------------------------------------------------------

describe('scheduleLocalNotification', () => {
  beforeEach(() => {
    getNotifee().displayNotification.mockResolvedValue({ id: 'notifee-id-1' });
    resetPrefs();
  });

  test('fires callback when all settings are enabled', async () => {
    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));

    await scheduleLocalNotification({
      title: 'Hello',
      body: 'World',
      type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
    });

    expect(received.length).toBe(1);
    expect(received[0]!.title).toBe('Hello');
    unsub();
  });

  test('does not fire when allEnabled is false', async () => {
    usePrefsStore.getState().setAllEnabled(false);
    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));

    await scheduleLocalNotification({ title: 'x', body: 'y' });

    expect(received.length).toBe(0);
    unsub();
  });

  test('does not fire when specific type preference is off', async () => {
    usePrefsStore
      .getState()
      .toggleType(NOTIFICATION_TYPES.REWARD_CONFIRMED, false);
    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));

    await scheduleLocalNotification({
      title: 'x',
      body: 'y',
      type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
    });

    expect(received.length).toBe(0);
    unsub();
  });

  test('reward_confirmed notification has correct data shape', async () => {
    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));

    await scheduleLocalNotification({
      title: 'Reward confirmed! 🎉',
      body: 'You earned 50 ECO for "Plant a tree".',
      type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
      data: {
        type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
        activityId: 'act-1',
        deepLink: 'ecotask://wallet',
      },
    });

    expect(received[0]!).toMatchObject({
      title: 'Reward confirmed! 🎉',
      body: expect.stringContaining('50 ECO'),
      data: expect.objectContaining({
        type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
        deepLink: 'ecotask://wallet',
      }),
    });
    unsub();
  });
});

// ---------------------------------------------------------------------------
// 6. scheduleDailyStreakReminder — suppression logic
// ---------------------------------------------------------------------------

describe('scheduleDailyStreakReminder', () => {
  beforeEach(() => {
    getNotifee().displayNotification.mockResolvedValue({ id: 'notifee-id-1' });
    resetPrefs();
    resetActivity();
  });

  test('does not fire when user has already completed a task today', async () => {
    useActivityStore.getState().addActivity({
      id: 'a1',
      taskId: 't1',
      taskTitle: 'Test',
      taskType: 'TRASH_COLLECTION',
      rewardAmount: 10,
      rewardToken: 'ECO',
      completedAt: new Date().toISOString(),
      status: 'confirmed',
    });

    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));
    await scheduleDailyStreakReminder();
    expect(received.length).toBe(0);
    unsub();
  });

  test('does not fire when streak_reminder preference is disabled', async () => {
    usePrefsStore
      .getState()
      .toggleType(NOTIFICATION_TYPES.STREAK_REMINDER, false);

    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));
    await scheduleDailyStreakReminder();
    expect(received.length).toBe(0);
    unsub();
  });

  test('does not fire when allEnabled is false', async () => {
    usePrefsStore.getState().setAllEnabled(false);

    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));
    await scheduleDailyStreakReminder();
    expect(received.length).toBe(0);
    unsub();
  });

  test('fires when no task completed today and preferences are on', async () => {
    // Add a confirmed activity from yesterday so there are activities but none today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useActivityStore.getState().addActivity({
      id: 'a2',
      taskId: 't2',
      taskTitle: 'Old task',
      taskType: 'TRASH_COLLECTION',
      rewardAmount: 5,
      rewardToken: 'ECO',
      completedAt: yesterday.toISOString(),
      status: 'confirmed',
    });

    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));
    await scheduleDailyStreakReminder();
    expect(received.length).toBe(1);
    expect(received[0]!.data?.type).toBe(NOTIFICATION_TYPES.STREAK_REMINDER);
    expect(received[0]!.data?.deepLink).toBe('ecotask://tasks');
    unsub();
  });

  test('title references current streak when streak > 0', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useActivityStore.getState().addActivity({
      id: 'a3',
      taskId: 't3',
      taskTitle: 'Yesterday task',
      taskType: 'TRASH_COLLECTION',
      rewardAmount: 8,
      rewardToken: 'ECO',
      completedAt: yesterday.toISOString(),
      status: 'confirmed',
    });

    const streak = useActivityStore.getState().streak;
    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));
    await scheduleDailyStreakReminder();

    if (streak > 0) {
      expect(received[0]!.title).toContain(`${streak}-day streak`);
    } else {
      expect(received[0]!.title).toContain('waiting');
    }
    unsub();
  });

  test('body encourages first task when streak is 0', async () => {
    // No activities → streak stays 0
    const received: NotificationPayload[] = [];
    const unsub = onNotificationReceived(p => received.push(p));
    await scheduleDailyStreakReminder();
    expect(received[0]!.body).toContain('climate-action task');
    unsub();
  });
});
