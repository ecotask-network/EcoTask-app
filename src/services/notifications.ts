import { Platform, PermissionsAndroid } from 'react-native';
import { usePrefsStore } from '../store/prefsStore';
import { isNowInQuietHours } from '../utils/quietHours';
import { dayKey } from '../utils/streaks';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { useActivityStore } from '../store/activityStore';
import api from './api';
import { getMessaging } from './firebaseMessaging';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

let onNotificationCallback: ((payload: NotificationPayload) => void) | null =
  null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS!,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS permission is handled by the system prompt when registering
  return true;
}

/**
 * Attempt to obtain an FCM token via @react-native-firebase/messaging.
 *
 * The library is a peer-dependency that requires platform-specific files
 * (google-services.json on Android, GoogleService-Info.plist on iOS) which
 * are intentionally gitignored. If these files are absent (e.g. in CI) the
 * adapter returns null, keeping tests and CI green.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }

    const messaging = getMessaging();

    // iOS requires an explicit authorization request via FCM.
    if (Platform.OS === 'ios') {
      try {
        // requestPermission() returns the Firebase AuthorizationStatus enum
        // value. We compare against hardcoded numbers to avoid a hard
        // require('@react-native-firebase/messaging') which Metro would
        // resolve at bundle time even inside a try/catch (breaking CI when
        // the native Firebase module is absent).
        //   1 = AUTHORIZED, 2 = PROVISIONAL
        const authStatus = await messaging.requestPermission();
        if (authStatus !== 1 && authStatus !== 2) {
          return null;
        }
      } catch {
        // iOS permission check failed — proceed; getToken will also fail and
        // return null if the app is not authorised.
      }
    }

    const token = await messaging.getToken();
    return token ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to FCM token refresh events and re-register with the backend
 * whenever the token rotates. Returns an unsubscribe function.
 */
export function listenForTokenRefresh(
  onToken: (token: string) => void,
): () => void {
  const messaging = getMessaging();
  return messaging.onTokenRefresh(onToken);
}

export async function sendTokenToServer(token: string): Promise<void> {
  // POST token to backend for server-side push notification delivery
  // The backend stores this token and uses it to send targeted notifications
  try {
    await api.post('/notifications/register', { token });
  } catch {
    // Best-effort registration
  }
}

export function onNotificationReceived(
  callback: (payload: NotificationPayload) => void,
): () => void {
  onNotificationCallback = callback;
  return () => {
    onNotificationCallback = null;
  };
}

// Notification types (re-exported from constants to avoid circular imports)
export { NOTIFICATION_TYPES } from '../constants/notificationTypes';
export async function scheduleLocalNotification(
  payload: NotificationPayload & { type?: string },
): Promise<void> {
  // Check global prefs and quiet hours before firing
  const prefs = usePrefsStore.getState();
  if (!prefs.allEnabled) {
    return;
  }

  const type =
    payload.type || payload.data?.type || payload.data?.notificationType;
  if (type && prefs.notificationPrefs[type] === false) {
    return;
  }

  const { from, to } = prefs.quietHours;
  if (isNowInQuietHours(from, to)) {
    return;
  }

  // Best-effort: if notifee is available and payload requests scheduling, use it
  try {
    const { default: notifee } = await import('@notifee/react-native');
    // If payload contains a timestamp/data.trigger we could schedule; for now display immediately
    const notificationId = await notifee.displayNotification({
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    usePrefsStore.getState().addScheduledId(type || 'unknown', notificationId);
    onNotificationCallback?.(payload);
    return;
  } catch {
    // fallback to local callback
    onNotificationCallback?.(payload);
  }
}

/**
 * Schedule (or fire immediately as a local notification) a daily streak
 * reminder. Suppressed when:
 *  - the user has already completed a task today, or
 *  - the streak_reminder preference is disabled, or
 *  - quiet hours are active.
 *
 * Reads activityStore lazily (via .getState()) to work correctly from a
 * background context where the store is rehydrated from MMKV before this
 * function is called.
 */
export async function scheduleDailyStreakReminder(): Promise<void> {
  // Suppress if preference is off or notifications globally disabled
  const prefs = usePrefsStore.getState();
  if (!prefs.allEnabled) {
    return;
  }

  if (prefs.notificationPrefs?.[NOTIFICATION_TYPES.STREAK_REMINDER] === false) {
    return;
  }

  // Suppress if the user already completed a task today
  const activities = useActivityStore.getState().activities;
  const todayKey = dayKey(new Date());
  const completedToday = activities.some(
    a => a.status === 'confirmed' && dayKey(a.completedAt) === todayKey,
  );
  if (completedToday) {
    return;
  }

  const streak = useActivityStore.getState().streak;
  const title =
    streak > 0
      ? `Keep your ${streak}-day streak! 🔥`
      : 'New tasks are waiting 🌱';
  const body =
    streak > 0
      ? "Don't let your streak end — complete a task today."
      : 'Earn ECO tokens by completing a climate-action task today.';

  await scheduleLocalNotification({
    title,
    body,
    type: NOTIFICATION_TYPES.STREAK_REMINDER,
    data: {
      type: NOTIFICATION_TYPES.STREAK_REMINDER,
      deepLink: 'ecotask://tasks',
    },
  });
}
